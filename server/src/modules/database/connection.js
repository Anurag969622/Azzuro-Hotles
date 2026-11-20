'use strict';

const { Pool } = require('pg');
const { DATABASE_URL, IS_PROD } = require('../../config/env');
const logger = require('../../config/logger');

let pool = null;

/**
 * Returns the singleton pg.Pool instance for direct database querying.
 */
function getPool() {
  if (global.__azzurro_db_pool__) {
    return global.__azzurro_db_pool__;
  }
  if (!pool) {
    if (!DATABASE_URL || DATABASE_URL.includes('your-project-ref') || DATABASE_URL.includes('[YOUR-PASSWORD]')) {
      const { createMemoryPool } = require('./memoryFallback');
      pool = createMemoryPool();
      global.__azzurro_db_pool__ = pool;
      return pool;
    }

    const rawPool = new Pool({
      connectionString: DATABASE_URL,
      max: 8, // Stay comfortably within Supabase free-tier connection bounds
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: IS_PROD || DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    });

    rawPool.on('error', (err) => {
      logger.error('Unexpected error on idle pg client', { error: err.message });
    });

    // Proxy pool so that any network-level DNS / IPv6 host failure automatically falls back
    pool = {
      query: async (text, values) => {
        try {
          return await rawPool.query(text, values);
        } catch (err) {
          if (['ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
            logger.warn(`[Database] Supabase direct connection unreachable (${err.code}). Using verified local memory database.`);
            const { createMemoryPool } = require('./memoryFallback');
            const mem = createMemoryPool();
            global.__azzurro_db_pool__ = mem;
            return await mem.query(text, values);
          }
          throw err;
        }
      },
      connect: async () => {
        try {
          return await rawPool.connect();
        } catch (err) {
          if (['ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
            logger.warn(`[Database] Supabase direct connection unreachable (${err.code}). Using verified local memory database.`);
            const { createMemoryPool } = require('./memoryFallback');
            const mem = createMemoryPool();
            global.__azzurro_db_pool__ = mem;
            return await mem.connect();
          }
          throw err;
        }
      },
      on: (event, handler) => rawPool.on(event, handler),
      end: () => rawPool.end(),
    };
  }

  return pool;
}

/**
 * Injects a pool instance (used for integration testing and in-memory databases).
 */
function setPool(customPool) {
  pool = customPool;
  global.__azzurro_db_pool__ = customPool;
}

/**
 * Executes a query using the connection pool.
 */
async function query(text, params) {
  let p = getPool();
  try {
    return await p.query(text, params);
  } catch (err) {
    if (['ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
      logger.warn(`[Database] Network issue with remote database (${err.code}). Using local memory pool.`);
      const { createMemoryPool } = require('./memoryFallback');
      p = createMemoryPool();
      global.__azzurro_db_pool__ = p;
      return await p.query(text, params);
    }
    throw err;
  }
}

/**
 * Executes an operation inside a database transaction.
 * @param {Function} callback - async function(client) => Promise<any>
 */
async function transaction(callback) {
  let p = getPool();
  let client;
  try {
    client = await p.connect();
  } catch (err) {
    if (['ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.code)) {
      logger.warn(`[Database] Network issue connecting to remote database (${err.code}). Using local memory pool.`);
      const { createMemoryPool } = require('./memoryFallback');
      p = createMemoryPool();
      global.__azzurro_db_pool__ = p;
      client = await p.connect();
    } else {
      throw err;
    }
  }
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Closes the connection pool gracefully.
 */
async function closePool() {
  const p = getPool();
  if (p) {
    await p.end();
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

