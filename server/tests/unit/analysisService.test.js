import { describe, it, expect, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import analysisService from '../../src/modules/analytics/analysisService';

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

describe('Analysis Service & Database Integration Tests', () => {
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
    };
  });

  it('persists AI sentiment and multi-label topics in database without duplicate topic records', async () => {
    const propRows = db.public.many('SELECT id FROM properties LIMIT 1');
    const propId = propRows[0].id;
    const revId = '00000000-0000-0000-0000-000000000101';

    // Insert a review
    db.public.none(`
      INSERT INTO reviews (id, property_id, fingerprint, rating, review_date, full_text)
      VALUES ('${revId}', '${propId}', 'fp-test-ai', 8.5, '2026-03-10', 'The location was great, but the bathroom was dirty.');
    `);

    // Mock AI batch response
    vi.spyOn(analysisService, 'callAiBatch').mockResolvedValue({
      results: [
        {
          review_id: revId,
          overall_sentiment: 'mixed',
          sentiment_confidence: 0.92,
          detected_language: 'en',
          model_name: 'azzurro-hybrid-nlp-v1',
          model_version: '1.0.0',
          analysis_status: 'completed',
          topics: [
            { topic_name: 'Location', topic_sentiment: 'positive', confidence: 0.95 },
            { topic_name: 'Cleanliness', topic_sentiment: 'negative', confidence: 0.88 },
          ],
        },
      ],
    });

    const summary = await analysisService.processBatch({
      batchSize: 10,
      poolOverride: poolAdapter,
    });

    expect(summary.processed).toBe(1);
    expect(summary.savedAnalyses).toBe(1);
    expect(summary.savedTopics).toBe(2);

    // Verify stored analysis record
    const analysisRows = db.public.many(`SELECT * FROM review_analyses WHERE review_id = '${revId}'`);
    expect(analysisRows.length).toBe(1);
    expect(analysisRows[0].overall_sentiment).toBe('mixed');
    expect(Number(analysisRows[0].sentiment_confidence)).toBe(0.92);

    // Verify stored topic records
    const topicRows = db.public.many(`SELECT * FROM review_topics WHERE review_id = '${revId}'`);
    expect(topicRows.length).toBe(2);
    const locTopic = topicRows.find(t => t.topic_name === 'Location');
    expect(locTopic.topic_sentiment).toBe('positive');
  });

  it('records human manual corrections without overwriting original AI model prediction', async () => {
    const propRows = db.public.many('SELECT id FROM properties LIMIT 1');
    const propId = propRows[0].id;
    const revId = '00000000-0000-0000-0000-000000000102';

    // Seed review & initial AI analysis
    db.public.none(`
      INSERT INTO reviews (id, property_id, fingerprint, rating, review_date, full_text)
      VALUES ('${revId}', '${propId}', 'fp-test-ai-2', 7.0, '2026-03-10', 'Adequate stay.');

      INSERT INTO review_analyses (review_id, overall_sentiment, sentiment_confidence, model_name, model_version, analysis_status)
      VALUES ('${revId}', 'neutral', 0.65, 'azzurro-hybrid-nlp-v1', '1.0.0', 'completed');
    `);

    // Record human correction: manager changes neutral -> positive
    const correctionResult = await analysisService.recordCorrection({
      reviewId: revId,
      targetEntity: 'review_analysis',
      fieldName: 'overall_sentiment',
      oldValue: 'neutral',
      newValue: 'positive',
      reason: 'Guest expressed subtle satisfaction in comment context',
      correctedBy: 'manager@azzurrohotels.com',
      poolOverride: poolAdapter,
    });

    expect(correctionResult.verified).toBe(true);

    // Check manual_corrections table has audit record
    const correctionAudit = db.public.many(`SELECT * FROM manual_corrections WHERE review_id = '${revId}'`);
    expect(correctionAudit.length).toBe(1);
    expect(correctionAudit[0].old_value).toBe('neutral');
    expect(correctionAudit[0].new_value).toBe('positive');
    expect(correctionAudit[0].corrected_by).toBe('manager@azzurrohotels.com');

    // Crucial requirement: original AI prediction in review_analyses must NOT be overwritten!
    const originalAnalysis = db.public.many(`SELECT * FROM review_analyses WHERE review_id = '${revId}'`);
    expect(originalAnalysis.length).toBe(1);
    expect(originalAnalysis[0].overall_sentiment).toBe('neutral'); // Preserved!
    expect(originalAnalysis[0].manually_verified).toBe(true);      // Flagged!
  });
});
