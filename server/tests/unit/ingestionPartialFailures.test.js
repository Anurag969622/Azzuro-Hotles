import { describe, it, expect, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ingestionService from '../../src/modules/collection/ingestionService';
import * as dbConn from '../../src/modules/database/connection';

function prepareSql(rawSql) {
  return rawSql
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '')
    .replace(/SET timezone = 'UTC';/g, '')
    .replace(/CREATE OR REPLACE FUNCTION update_updated_at_column[\s\S]*$/g, '');
}

function interpolateQuery(sql, params) {
  if (!params || params.length === 0) return sql;
  return sql.replace(/\$(\d+)/g, (match, idx) => {
    const val = params[parseInt(idx, 10) - 1];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
  });
}

describe('Database Repeated Imports & Partial Failures Tests', () => {
  let db;
  let poolAdapter;

  beforeEach(async () => {
    db = newDb();

    db.public.registerFunction({
      name: 'gen_random_uuid',
      returns: db.public.getType('text'),
      implementation: () => crypto.randomUUID(),
      impure: true,
    });

    db.public.registerFunction({
      name: 'timezone',
      args: ['text', 'timestamp with time zone'],
      implementation: (tz, dt) => dt || new Date().toISOString(),
    });

    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const seedPath = path.resolve(__dirname, '../../../database/migrations/002_seed_properties.sql');

    await db.public.none(prepareSql(fs.readFileSync(migrationPath, 'utf8')));
    await db.public.none(fs.readFileSync(seedPath, 'utf8'));

    // Create PG adapter interface matching pg.Pool that converts parameterized queries for pg-mem
    poolAdapter = {
      query: async (sql, params) => {
        const resolved = interpolateQuery(sql, params);
        if (/^\s*(INSERT|UPDATE|DELETE)/i.test(resolved) && !/RETURNING/i.test(resolved)) {
          db.public.none(resolved);
          return { rows: [], rowCount: 1 };
        }
        const rows = db.public.many(resolved);
        return { rows, rowCount: rows.length };
      },
      connect: async () => poolAdapter,
      release: () => {},
    };
  });

  it('handles repeated imports gracefully by detecting duplicate records', async () => {
    const records = [
      {
        property_code: 'OLYMPIC-PADDINGTON',
        source: 'csv_import',
        source_review_id: 'REV-001',
        rating: 9.0,
        review_date: '2026-03-01',
        positive_text: 'Spotless room',
        negative_text: null,
        full_text: 'Spotless room',
        fingerprint: 'fp-rev-001',
      },
    ];

    // First import
    const summary1 = await ingestionService.ingestRecords({
      records,
      source: 'csv_import',
      fileName: 'run1.csv',
      poolOverride: poolAdapter,
    });

    expect(summary1.insertedCount).toBe(1);
    expect(summary1.duplicateCount).toBe(0);

    // Second import of same records
    const summary2 = await ingestionService.ingestRecords({
      records,
      source: 'csv_import',
      fileName: 'run2.csv',
      poolOverride: poolAdapter,
    });

    expect(summary2.insertedCount).toBe(0);
    expect(summary2.duplicateCount).toBe(1);
  });

  it('handles partial failures cleanly (unknown property code / invalid row reporting)', async () => {
    const records = [
      {
        property_code: 'NON_EXISTENT_HOTEL',
        source: 'csv_import',
        source_review_id: 'REV-ERR-1',
        rating: 8.0,
        review_date: '2026-03-01',
        fingerprint: 'fp-err-1',
      },
      {
        property_code: 'POTTS-POINT',
        source: 'csv_import',
        source_review_id: 'REV-VALID-1',
        rating: 9.5,
        review_date: '2026-03-01',
        fingerprint: 'fp-valid-1',
      },
    ];

    const failedRows = [
      { rowIndex: 3, raw: { rating: 'invalid' }, error: 'Invalid rating numeric format' },
    ];

    const summary = await ingestionService.ingestRecords({
      records,
      failedRows,
      source: 'csv_import',
      fileName: 'partial_fail.csv',
      poolOverride: poolAdapter,
    });

    expect(summary.totalSubmitted).toBe(3);
    expect(summary.insertedCount).toBe(1);
    expect(summary.rejectedCount).toBe(2); // 1 unmapped property + 1 pre-failed row
    expect(summary.status).toBe('partial');
    expect(summary.failedRows.length).toBe(2);
  });
});
