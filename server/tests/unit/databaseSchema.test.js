import { describe, it, expect, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

import crypto from 'crypto';

function prepareSql(rawSql) {
  return rawSql
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '')
    .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '')
    .replace(/SET timezone = 'UTC';/g, '')
    .replace(/CREATE OR REPLACE FUNCTION update_updated_at_column[\s\S]*$/g, '');
}

describe('Database Schema, Constraints & Seed Tests (in-memory Postgres)', () => {
  let db;

  beforeEach(() => {
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
  });

  it('successfully creates all tables, check constraints, and unique indexes from migration', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));

    await db.public.none(sql);

    // Verify all 8 core tables exist
    const tables = ['properties', 'collection_batches', 'reviews', 'review_analyses', 'review_topics', 'collection_logs', 'manual_corrections', 'scheduled_jobs'];
    for (const t of tables) {
      const res = db.public.many(`SELECT * FROM ${t}`);
      expect(Array.isArray(res)).toBe(true);
    }
  });

  it('enforces rating CHECK constraint (rating >= 0 AND rating <= 10)', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));
    await db.public.none(sql);

    const propId = 'a0000000-0000-0000-0000-000000000001';
    db.public.none(`
      INSERT INTO properties (id, property_code, name, booking_url, location)
      VALUES ('${propId}', 'PROP-TEST', 'Test Hotel', 'https://booking.com/test', 'Sydney');
    `);

    // Invalid rating > 10 should throw check constraint violation
    expect(() => {
      db.public.none(`
        INSERT INTO reviews (property_id, fingerprint, rating, review_date)
        VALUES ('${propId}', 'fp-1', 11.5, '2026-01-01');
      `);
    }).toThrow();

    // Invalid rating < 0 should throw check constraint violation
    expect(() => {
      db.public.none(`
        INSERT INTO reviews (property_id, fingerprint, rating, review_date)
        VALUES ('${propId}', 'fp-1', -1.0, '2026-01-01');
      `);
    }).toThrow();

    // Valid rating should succeed
    expect(() => {
      db.public.none(`
        INSERT INTO reviews (property_id, fingerprint, rating, review_date)
        VALUES ('${propId}', 'fp-1', 9.2, '2026-01-01');
      `);
    }).not.toThrow();
  });

  it('enforces foreign key cascading deletes from properties to reviews and analyses', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));
    await db.public.none(sql);

    const propId = 'b0000000-0000-0000-0000-000000000001';
    const revId = 'c0000000-0000-0000-0000-000000000001';

    db.public.none(`
      INSERT INTO properties (id, property_code, name, booking_url, location)
      VALUES ('${propId}', 'PROP-CASCADE', 'Cascade Hotel', 'https://booking.com/cascade', 'Sydney');

      INSERT INTO reviews (id, property_id, fingerprint, rating, review_date)
      VALUES ('${revId}', '${propId}', 'fp-cascade', 8.5, '2026-01-01');

      INSERT INTO review_analyses (review_id, overall_sentiment, sentiment_confidence, model_name, model_version)
      VALUES ('${revId}', 'positive', 0.95, 'roberta', 'v1');
    `);

    // Verify insertion
    expect(db.public.many(`SELECT * FROM reviews WHERE id = '${revId}'`).length).toBe(1);
    expect(db.public.many(`SELECT * FROM review_analyses WHERE review_id = '${revId}'`).length).toBe(1);

    // Deleting property should cascade delete reviews and analyses
    db.public.none(`DELETE FROM properties WHERE id = '${propId}';`);
    expect(db.public.many(`SELECT * FROM reviews WHERE id = '${revId}'`).length).toBe(0);
    expect(db.public.many(`SELECT * FROM review_analyses WHERE review_id = '${revId}'`).length).toBe(0);
  });

  it('enforces content fingerprint deduplication constraint', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));
    await db.public.none(sql);

    const propId = 'd0000000-0000-0000-0000-000000000001';
    db.public.none(`
      INSERT INTO properties (id, property_code, name, booking_url, location)
      VALUES ('${propId}', 'PROP-DEDUP', 'Dedup Hotel', 'https://booking.com/dedup', 'Sydney');

      INSERT INTO reviews (property_id, fingerprint, rating, review_date)
      VALUES ('${propId}', 'same-hash-12345', 8.0, '2026-02-01');
    `);

    // Inserting identical fingerprint for the same property must violate unique index
    expect(() => {
      db.public.none(`
        INSERT INTO reviews (property_id, fingerprint, rating, review_date)
        VALUES ('${propId}', 'same-hash-12345', 9.0, '2026-02-02');
      `);
    }).toThrow();
  });

  it('enforces unique constraint on review_topics (prevent duplicate topic per review)', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));
    await db.public.none(sql);

    const propId = 'e0000000-0000-0000-0000-000000000001';
    const revId = 'e0000000-0000-0000-0000-000000000002';
    db.public.none(`
      INSERT INTO properties (id, property_code, name, booking_url, location)
      VALUES ('${propId}', 'PROP-TOPIC', 'Topic Hotel', 'https://booking.com/topic', 'Sydney');

      INSERT INTO reviews (id, property_id, fingerprint, rating, review_date)
      VALUES ('${revId}', '${propId}', 'fp-topic-1', 8.0, '2026-02-01');

      INSERT INTO review_topics (review_id, topic_name, topic_sentiment, confidence)
      VALUES ('${revId}', 'cleanliness', 'positive', 0.98);
    `);

    // Duplicate topic for the same review must fail
    expect(() => {
      db.public.none(`
        INSERT INTO review_topics (review_id, topic_name, topic_sentiment, confidence)
        VALUES ('${revId}', 'cleanliness', 'neutral', 0.50);
      `);
    }).toThrow();

    // Different topic for same review must succeed
    expect(() => {
      db.public.none(`
        INSERT INTO review_topics (review_id, topic_name, topic_sentiment, confidence)
        VALUES ('${revId}', 'staff', 'positive', 0.92);
      `);
    }).not.toThrow();
  });

  it('seeds all 4 hotel properties idempotently', async () => {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const seedPath = path.resolve(__dirname, '../../../database/migrations/002_seed_properties.sql');

    const sql = prepareSql(fs.readFileSync(migrationPath, 'utf8'));
    await db.public.none(sql);

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await db.public.none(seedSql);

    const rows = db.public.many('SELECT property_code, name, location FROM properties ORDER BY property_code');
    expect(rows.length).toBe(4);
    expect(rows.map(r => r.property_code)).toEqual([
      'CENTRAL-SYDNEY',
      'DARLING-HARBOUR',
      'OLYMPIC-PADDINGTON',
      'POTTS-POINT'
    ]);

    // Running seed a second time should succeed without duplicating (idempotency)
    await db.public.none(seedSql);
    const rowsAfterReSeed = db.public.many('SELECT property_code FROM properties');
    expect(rowsAfterReSeed.length).toBe(4);
  });
});
