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
      return null;
    }

    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 8, // Stay comfortably within Supabase free-tier connection bounds
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: IS_PROD || DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle pg client', { error: err.message });
    });
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
  const p = getPool();
  if (!p) {
    throw new Error('Database pool is not configured. Check DATABASE_URL in server/.env');
  }
  return p.query(text, params);
}

/**
 * Executes an operation inside a database transaction.
 * @param {Function} callback - async function(client) => Promise<any>
 */
async function transaction(callback) {
  const p = getPool();
  if (!p) {
    throw new Error('Database pool is not configured. Check DATABASE_URL in server/.env');
  }
  const client = await p.connect();
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

