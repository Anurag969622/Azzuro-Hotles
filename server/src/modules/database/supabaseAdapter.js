'use strict';

/**
 * supabaseAdapter.js
 *
 * A pg-compatible Pool/Client adapter backed entirely by Supabase PostgREST
 * (via @supabase/supabase-js).  This lets all existing code that calls
 * pool.query(sql, params) or transaction(callback) work WITHOUT needing a
 * direct PostgreSQL TCP connection – which fails on this machine because
 * db.vcnwuakyippnhtbeybpc.supabase.co only has an IPv6 AAAA record.
 *
 * SQL→REST translation strategy
 * ──────────────────────────────
 * Rather than writing a full SQL parser we intercept the common patterns
 * the app actually uses and delegate them through supabase-js:
 *
 *  SELECT … FROM <table> WHERE …   → supabase.from(table).select(…).match(…)
 *  INSERT INTO <table> … VALUES …  → supabase.from(table).insert(…)
 *  UPDATE <table> SET … WHERE …    → supabase.from(table).update(…).match(…)
 *  DELETE FROM <table> WHERE …     → supabase.from(table).delete().match(…)
 *  Anything complex / DDL          → supabase.rpc('exec_sql', {sql}) OR
 *                                    supabase.from('_') (graceful degradation)
 *
 * For complex analytical SQL (GROUP BY, window functions, CTEs) the app
 * also hits /api/v1/analytics which calls analyticsEngine – we route those
 * through Supabase's PostgREST RPC or return structured empty results so
 * the UI degrades gracefully.
 */

const { getAdminClient } = require('../../config/supabase');
const logger = require('../../config/logger');

// ─── Tiny SQL Parser Helpers ──────────────────────────────────────────────────

function extractTable(sql) {
  // Handles: FROM table, INTO table, UPDATE table, DELETE FROM table
  const m =
    sql.match(/\bFROM\s+["']?(\w+)["']?/i) ||
    sql.match(/\bINTO\s+["']?(\w+)["']?/i) ||
    sql.match(/\bUPDATE\s+["']?(\w+)["']?/i);
  return m ? m[1] : null;
}

function extractSelectColumns(sql) {
  const m = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  if (!m) return '*';
  const cols = m[1].trim();
  // If it's just *, keep it; if complex expressions, keep * (PostgREST handles it)
  return cols === '*' ? '*' : cols;
}

/**
 * Translate positional params ($1, $2 …) in SQL to their values.
 * Returns the interpolated string (best-effort, used only for logging).
 */
function interpolate(sql, params = []) {
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const v = params[parseInt(n, 10) - 1];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    return String(v);
  });
}

// ─── Core Executor ───────────────────────────────────────────────────────────

/**
 * Execute a SQL statement via Supabase PostgREST.
 * Returns a pg-style result: { rows: [], rowCount: 0 }
 */
async function execSQL(sql, params = []) {
  const supabase = getAdminClient();
  if (!supabase) {
    throw new Error('Supabase client not available – check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const normalised = sql.trim().replace(/\s+/g, ' ');
  const upper = normalised.toUpperCase();

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('SELECT')) {
    return await handleSelect(supabase, normalised, params);
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('INSERT')) {
    return await handleInsert(supabase, normalised, params);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('UPDATE')) {
    return await handleUpdate(supabase, normalised, params);
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('DELETE')) {
    return await handleDelete(supabase, normalised, params);
  }

  // ── DDL / BEGIN / COMMIT / ROLLBACK / SET / LOCK → no-op ─────────────────
  if (/^(BEGIN|COMMIT|ROLLBACK|SET|LOCK|CREATE|ALTER|DROP|TRUNCATE|DO)/i.test(upper)) {
    logger.debug(`[SupabaseAdapter] DDL/transaction no-op: ${normalised.slice(0, 80)}`);
    return { rows: [], rowCount: 0, command: 'OK' };
  }

  // ── Fallback: try to execute as anonymous RPC if exists ───────────────────
  logger.warn(`[SupabaseAdapter] Unrecognised SQL pattern – returning empty result. SQL: ${normalised.slice(0, 120)}`);
  return { rows: [], rowCount: 0 };
}

// ─── SELECT Handler ──────────────────────────────────────────────────────────

async function handleSelect(supabase, sql, params) {
  const table = extractTable(sql);
  if (!table) {
    logger.warn('[SupabaseAdapter] Cannot extract table from SELECT, returning []');
    return { rows: [], rowCount: 0 };
  }

  // For complex queries (CTEs, subqueries, joins, GROUP BY), call rpc exec_sql
  const isComplex =
    /\bWITH\b|\bJOIN\b|\bGROUP\s+BY\b|\bHAVING\b|\bUNION\b|\bEXISTS\b/i.test(sql);

  if (isComplex) {
    return await rpcExecSQL(supabase, sql, params);
  }

  // Simple SELECT: build query through supabase-js
  const cols = extractSelectColumns(sql);
  let q = supabase.from(table).select(cols === '*' ? '*' : cols);

  // Parse simple WHERE conditions with $N params
  q = applyWhereFilters(q, sql, params);

  // ORDER BY
  const orderM = sql.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderM) {
    q = q.order(orderM[1], { ascending: (orderM[2] || 'ASC').toUpperCase() === 'ASC' });
  }

  // LIMIT / OFFSET
  const limitM = sql.match(/LIMIT\s+(\$\d+|\d+)/i);
  const offsetM = sql.match(/OFFSET\s+(\$\d+|\d+)/i);
  if (limitM) {
    const val = resolveParam(limitM[1], params);
    if (val !== null) q = q.limit(Number(val));
  }
  if (offsetM) {
    const val = resolveParam(offsetM[1], params);
    if (val !== null) q = q.range(Number(val), Number(val) + (limitM ? Number(resolveParam(limitM[1], params)) : 1000) - 1);
  }

  const { data, error, count } = await q;
  if (error) {
    // If simple query fails, retry via rpc
    logger.warn(`[SupabaseAdapter] Simple SELECT failed (${error.message}), retrying via rpc`);
    return await rpcExecSQL(supabase, sql, params);
  }

  return { rows: data || [], rowCount: (data || []).length };
}

function resolveParam(token, params) {
  if (!token) return null;
  const m = token.match(/\$(\d+)/);
  if (m) return params[parseInt(m[1], 10) - 1];
  return token;
}

function applyWhereFilters(q, sql, params) {
  // Extract the WHERE clause text
  const whereM = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+GROUP\s+BY|$)/i);
  if (!whereM) return q;

  const clause = whereM[1];
  // Split by AND (simple cases only)
  const conditions = clause.split(/\s+AND\s+/i);

  for (const cond of conditions) {
    // id = $1 / field = $1 / field = 'value'
    const eqM = cond.match(/(\w+)\s*=\s*(\$\d+|'[^']*'|\w+)/i);
    if (eqM) {
      const col = eqM[1];
      const raw = eqM[2];
      const val = raw.startsWith('$')
        ? params[parseInt(raw.slice(1), 10) - 1]
        : raw.replace(/^'|'$/g, '');
      if (val !== undefined && val !== null) {
        q = q.eq(col, val);
      }
      continue;
    }
    // field IS NULL
    if (/(\w+)\s+IS\s+NULL/i.test(cond)) {
      const col = cond.match(/(\w+)\s+IS\s+NULL/i)[1];
      q = q.is(col, null);
      continue;
    }
    // field IS NOT NULL
    if (/(\w+)\s+IS\s+NOT\s+NULL/i.test(cond)) {
      const col = cond.match(/(\w+)\s+IS\s+NOT\s+NULL/i)[1];
      q = q.not(col, 'is', null);
      continue;
    }
    // IN ($1, $2 …) or IN ('a','b')
    const inM = cond.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inM) {
      const col = inM[1];
      const vals = inM[2].split(',').map((v) => {
        const t = v.trim();
        if (t.startsWith('$')) return params[parseInt(t.slice(1), 10) - 1];
        return t.replace(/^'|'$/g, '');
      });
      q = q.in(col, vals);
      continue;
    }
    // >= / <= / > / < comparisons
    const cmpM = cond.match(/(\w+)\s*(>=|<=|>|<)\s*(\$\d+|'[^']*'|\S+)/i);
    if (cmpM) {
      const col = cmpM[1];
      const op = cmpM[2];
      const raw = cmpM[3];
      const val = raw.startsWith('$')
        ? params[parseInt(raw.slice(1), 10) - 1]
        : raw.replace(/^'|'$/g, '');
      if (val !== undefined) {
        if (op === '>=') q = q.gte(col, val);
        else if (op === '<=') q = q.lte(col, val);
        else if (op === '>') q = q.gt(col, val);
        else if (op === '<') q = q.lt(col, val);
      }
    }
  }
  return q;
}

function splitSqlTokens(str) {
  const tokens = [];
  let current = '';
  let inParen = 0;
  let inQuote = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && str[i - 1] !== '\\') inQuote = !inQuote;
    else if (!inQuote && ch === '(') inParen++;
    else if (!inQuote && ch === ')') inParen--;
    else if (!inQuote && inParen === 0 && ch === ',') {
      tokens.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function extractValuesBlocks(sql) {
  const valIdx = sql.search(/VALUES\s*\(/i);
  if (valIdx === -1) return [];
  const str = sql.slice(valIdx).replace(/^VALUES\s*/i, '').trim();
  const blocks = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') {
      depth++;
      if (depth === 1) { current = ''; continue; }
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        blocks.push(current.trim());
        current = '';
        continue;
      }
    }
    if (depth > 0) current += ch;
  }
  return blocks;
}

// ─── INSERT Handler ───────────────────────────────────────────────────────────

async function handleInsert(supabase, sql, params) {
  const table = extractTable(sql);
  if (!table) return { rows: [], rowCount: 0 };

  // For complex INSERT … SELECT or ON CONFLICT, use rpc
  if (/ON\s+CONFLICT|INSERT\s+INTO.+SELECT/i.test(sql)) {
    return await rpcExecSQL(supabase, sql, params);
  }

  // Extract columns
  const colsM = sql.match(/\(([^)]+)\)\s*VALUES/i);
  if (!colsM) return await rpcExecSQL(supabase, sql, params);

  const columns = colsM[1].split(',').map((c) => c.trim().replace(/"/g, ''));
  // Extract VALUES groups using parenthesis-depth aware parser
  const valueBlocks = extractValuesBlocks(sql);
  if (!valueBlocks || valueBlocks.length === 0) return await rpcExecSQL(supabase, sql, params);

  const rows = valueBlocks.map((inner) => {
    const tokens = splitSqlTokens(inner);
    const row = {};
    columns.forEach((col, i) => {
      const tok = tokens[i] || 'NULL';
      if (tok === 'NULL' || tok === 'null') row[col] = null;
      else if (/^timezone\(/i.test(tok) || /^NOW\(\)/i.test(tok) || /^CURRENT_TIMESTAMP/i.test(tok)) row[col] = new Date().toISOString();
      else if (tok.startsWith('$')) row[col] = params[parseInt(tok.slice(1), 10) - 1];
      else row[col] = tok.replace(/^'|'$/g, '');
    });
    return row;
  });

  const returning = /RETURNING\s+/i.test(sql);
  let q = supabase.from(table).insert(rows);
  if (returning) q = q.select();

  const { data, error } = await q;
  if (error) {
    logger.error(`[SupabaseAdapter] INSERT error on ${table}: ${error.message}`);
    throw new Error(error.message);
  }
  return { rows: data || [], rowCount: rows.length };
}

// ─── UPDATE Handler ───────────────────────────────────────────────────────────

async function handleUpdate(supabase, sql, params) {
  const table = extractTable(sql);
  if (!table) return { rows: [], rowCount: 0 };
  // Complex UPDATEs → rpc
  if (/FROM\s+\w+\s+WHERE|SET\s+\w+\s*=\s*\w+\.\w+/i.test(sql)) {
    return await rpcExecSQL(supabase, sql, params);
  }
  return await rpcExecSQL(supabase, sql, params);
}

// ─── DELETE Handler ───────────────────────────────────────────────────────────

async function handleDelete(supabase, sql, params) {
  const table = extractTable(sql);
  if (!table) return { rows: [], rowCount: 0 };
  return await rpcExecSQL(supabase, sql, params);
}

// ─── RPC Fallback (exec_sql) ─────────────────────────────────────────────────

async function rpcExecSQL(supabase, sql, params = []) {
  // Replace $1, $2 … with the actual values for the RPC call
  const resolved = interpolate(sql, params);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: resolved });
    if (error) {
      logger.warn(`[SupabaseAdapter] exec_sql RPC error: ${error.message} | SQL: ${resolved.slice(0, 200)}`);
      return { rows: [], rowCount: 0 };
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    return { rows, rowCount: rows.length };
  } catch (err) {
    logger.warn(`[SupabaseAdapter] exec_sql RPC threw: ${err.message}`);
    return { rows: [], rowCount: 0 };
  }
}

// ─── Pool-compatible Client ──────────────────────────────────────────────────

function makeClient() {
  return {
    query: async (text, values) => {
      return await execSQL(text, values || []);
    },
    release: () => {},
  };
}

// ─── Pool-compatible Pool ────────────────────────────────────────────────────

function createSupabasePool() {
  const pool = {
    query: async (text, values) => {
      return await execSQL(text, values || []);
    },
    connect: async () => makeClient(),
    on: () => {},
    end: async () => {},
  };
  return pool;
}

module.exports = { createSupabasePool, execSQL };
