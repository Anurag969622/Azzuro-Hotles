'use strict';

const fs = require('fs');
const path = require('path');
const { getPool } = require('../../modules/database/connection');
const logger = require('../../config/logger');

async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    logger.warn('No active PostgreSQL pool configured (check DATABASE_URL). Skipping migrations.');
    return;
  }

  const client = await pool.connect();
  try {
    logger.info('Starting database migrations execution...');
    await client.query('BEGIN');

    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../../../database/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (rows.length === 0) {
        logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        logger.info(`Successfully applied: ${file}`);
      } else {
        logger.debug(`Migration already applied: ${file}`);
      }
    }

    await client.query('COMMIT');
    logger.info('All migrations processed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed and rolled back', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };

