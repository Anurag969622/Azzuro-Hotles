'use strict';

/**
 * connection.js
 *
 * Database abstraction layer.
 *
 * Uses the Supabase PostgREST adapter (supabaseAdapter.js) when
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (which they are in .env).
 *
 * Falls back to the pg-mem in-memory pool ONLY in test environments where
 * a pool is explicitly injected via setPool().
 *
 * ⚠  The old pg.Pool → IPv6 host → memoryFallback chain has been removed.
 *    All production data now flows through Supabase PostgREST.
 */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../../config/env');
const logger = require('../../config/logger');

let pool = null;

/**
 * Returns the singleton pool / adapter instance.
 */
function getPool() {
  if (pool) return pool;

  if (global.__azzurro_db_pool__) {
    pool = global.__azzurro_db_pool__;
    return pool;
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    logger.info('[Database] Connecting via Supabase PostgREST adapter (HTTP/HTTPS).');
    const { createSupabasePool } = require('./supabaseAdapter');
    pool = createSupabasePool();
    global.__azzurro_db_pool__ = pool;
    return pool;
  }

  // Should never reach here in production — env vars are required
  throw new Error(
    '[Database] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env. ' +
    'No database connection is available.'
  );
}

/**
 * Injects a pool instance (used for integration testing and in-memory databases).
 */
function setPool(customPool) {
  pool = customPool;
  global.__azzurro_db_pool__ = customPool;
}

/**
 * Executes a query using the connection pool / adapter.
 */
async function query(text, params) {
  const p = getPool();
  return await p.query(text, params);
}

/**
 * Executes an operation inside a database transaction.
 * @param {Function} callback - async function(client) => Promise<any>
 */
async function transaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    // BEGIN/COMMIT are no-ops in the Supabase adapter but kept for pg compatibility
    if (client.query) await client.query('BEGIN');
    const result = await callback(client);
    if (client.query) await client.query('COMMIT');
    return result;
  } catch (err) {
    if (client.query) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    throw err;
  } finally {
    if (client.release) client.release();
  }
}

/**
 * Closes the connection pool gracefully.
 */
async function closePool() {
  if (pool && pool.end) {
    await pool.end();
  }
  pool = null;
  global.__azzurro_db_pool__ = null;
}

module.exports = {
  getPool,
  setPool,
  query,
  transaction,
  closePool,
};
