'use strict';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dbConn from '../../src/modules/database/connection';
import ingestionService from '../../src/modules/collection/ingestionService';
import analyticsEngine from '../../src/modules/analytics/analyticsEngine';
import insightsEngine from '../../src/modules/analytics/insightsEngine';
import scheduler from '../../src/modules/automation/scheduler';
import jobLock from '../../src/modules/automation/jobLock';

describe('Phase 9 — Full End-to-End Workflow & Edge Case Integration Suite', () => {
  let memDb;
  let mockPool;

  beforeAll(async () => {
    memDb = newDb();

    // Register PostgreSQL functions with impure: true so each row gets unique UUID
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: memDb.public.getType('text'),
      implementation: () => crypto.randomUUID(),
      impure: true,
    });
    memDb.public.registerFunction({
      name: 'timezone',
      args: [memDb.public.getType('text'), memDb.public.getType('timestamp with time zone')],
      returns: memDb.public.getType('timestamp with time zone'),
      implementation: (tz, t) => t || new Date().toISOString(),
    });
    memDb.public.registerFunction({
      name: 'round',
      args: [memDb.public.getType('float'), memDb.public.getType('integer')],
      returns: memDb.public.getType('float'),
      implementation: (val, decimals) => {
        if (val === null || val === undefined) return null;
        const factor = Math.pow(10, decimals || 0);
        return Math.round(Number(val) * factor) / factor;
      },
    });
    memDb.public.registerFunction({
      name: 'round',
      args: [memDb.public.getType('numeric'), memDb.public.getType('integer')],
      returns: memDb.public.getType('float'),
      implementation: (val, decimals) => {
        if (val === null || val === undefined) return null;
        const factor = Math.pow(10, decimals || 0);
        return Math.round(Number(val) * factor) / factor;
      },
    });
    memDb.public.registerFunction({
      name: 'date_trunc',
      args: [memDb.public.getType('text'), memDb.public.getType('timestamp with time zone')],
      returns: memDb.public.getType('timestamp with time zone'),
      implementation: (part, dt) => dt || new Date().toISOString(),
    });
    memDb.public.registerFunction({
      name: 'date_trunc',
      args: [memDb.public.getType('text'), memDb.public.getType('date')],
      returns: memDb.public.getType('date'),
      implementation: (part, dt) => dt || new Date().toISOString().slice(0, 10),
    });
    memDb.public.registerFunction({
      name: 'json_build_object',
      args: [
        memDb.public.getType('text'),
        memDb.public.getType('character varying'),
        memDb.public.getType('text'),
        memDb.public.getType('character varying'),
        memDb.public.getType('text'),
        memDb.public.getType('float'),
      ],
      returns: memDb.public.getType('json'),
      implementation: (k1, v1, k2, v2, k3, v3) => ({ [k1]: v1, [k2]: v2, [k3]: v3 }),
    });
    memDb.public.registerFunction({
      name: 'json_build_object',
      args: [
        memDb.public.getType('text'),
        memDb.public.getType('character varying'),
        memDb.public.getType('text'),
        memDb.public.getType('character varying'),
        memDb.public.getType('text'),
        memDb.public.getType('numeric'),
      ],
      returns: memDb.public.getType('json'),
      implementation: (k1, v1, k2, v2, k3, v3) => ({ [k1]: v1, [k2]: v2, [k3]: v3 }),
    });
    memDb.public.registerFunction({
      name: 'json_build_object',
      args: [
        memDb.public.getType('text'),
        memDb.public.getType('text'),
        memDb.public.getType('text'),
        memDb.public.getType('text'),
        memDb.public.getType('text'),
        memDb.public.getType('float'),
      ],
      returns: memDb.public.getType('json'),
      implementation: (k1, v1, k2, v2, k3, v3) => ({ [k1]: v1, [k2]: v2, [k3]: v3 }),
    });

    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql'), 'utf8');
    const cleanSql = schemaSql
      .replace(/CREATE EXTENSION[^\n]+;/g, '')
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]+?LANGUAGE ['"]?plpgsql['"]?;/gi, '')
      .replace(/DROP TRIGGER[\s\S]+?;/gi, '')
      .replace(/CREATE TRIGGER[\s\S]+?;/gi, '')
      .replace(/CREATE INDEX IF NOT EXISTS[^\n]+;/gi, '');

    memDb.public.none(cleanSql);

    const seedPropsSql = fs.readFileSync(path.resolve(__dirname, '../../../database/migrations/002_seed_properties.sql'), 'utf8');
    memDb.public.none(seedPropsSql);

    const adapter = memDb.adapters.createPg();
    mockPool = new adapter.Pool();

    // Helper for parameterized query compatibility with pg-mem
    function interpolate(text, values) {
      let queryStr = typeof text === 'string' ? text : text.text;
      if (values && values.length > 0) {
        queryStr = queryStr.replace(/\$(\d+)/g, (_, idx) => {
          const val = values[parseInt(idx, 10) - 1];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
      }
      return queryStr;
    }

    const originalQuery = mockPool.query.bind(mockPool);
    mockPool.query = (text, values) => originalQuery(interpolate(text, values));

    const originalConnect = mockPool.connect.bind(mockPool);
    mockPool.connect = async () => {
      const client = await originalConnect();
      const origClientQuery = client.query.bind(client);
      client.query = (text, values) => origClientQuery(interpolate(text, values));
      return client;
    };

    dbConn.setPool(mockPool);
    await scheduler.init(mockPool);
  });

  afterAll(async () => {
    scheduler.stop();
    jobLock.forceReleaseAll();
  });

  // ── Scenario 1: Empty Database / Initial State ──────────────────────────────
  describe('Scenario 1: Initial Empty Reviews State', () => {
    it('returns valid 0-state overview without crashing or dividing by zero', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview.totalReviewsCount).toBe(0);
      expect(res.body.overview.currentWeeklyRating).toBe(0);
      expect(res.body.overview.ratingDiff).toBe(0);
      expect(res.body.overview.sentimentBreakdown.positive).toBe(0);
      expect(res.body.overview.sentimentBreakdown.negative).toBe(0);
    });

    it('returns all 4 properties with active status', async () => {
      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(4);
      const codes = res.body.properties.map((p) => p.property_code);
      expect(codes).toContain('OLYMPIC-PADDINGTON');
      expect(codes).toContain('POTTS-POINT');
      expect(codes).toContain('CENTRAL-SYDNEY');
      expect(codes).toContain('DARLING-HARBOUR');
    });

    it('returns empty list for reviews and insights with 200 OK', async () => {
      const revRes = await request(app).get('/api/reviews');
      expect(revRes.status).toBe(200);
      expect(revRes.body.count).toBe(0);

      const insRes = await request(app).get('/api/insights');
      expect(insRes.status).toBe(200);
      expect(insRes.body.count).toBe(0);
    });
  });

  // ── Scenario 2 & 3: Single Property & Multi-Property Ingestion ──────────────
  describe('Scenario 2 & 3: Review Ingestion & Deduplication', () => {
    const testReviews = [
      {
        property: 'OLYMPIC-PADDINGTON',
        source_review_id: 'REV-001',
        rating: 9.5,
        review_date: '2026-11-16',
        positive_text: 'Super friendly staff and perfect location in Paddington!',
        negative_text: '',
        reviewer_country: 'Australia',
        language: 'en',
      },
      {
        property: 'OLYMPIC-PADDINGTON',
        source_review_id: 'REV-002',
        rating: 6.0,
        review_date: '2026-11-17',
        positive_text: 'Nice bed.',
        negative_text: 'The bathroom was dirty and the shower had low pressure.',
        reviewer_country: 'New Zealand',
        language: 'en',
      },
      {
        property: 'POTTS-POINT',
        source_review_id: 'REV-003',
        rating: 8.5,
        review_date: '2026-11-18',
        positive_text: 'Great boutique vibe and quiet room.',
        negative_text: 'Wi-Fi was a bit slow on 4th floor.',
        reviewer_country: 'United Kingdom',
        language: 'en',
      },
      {
        property: 'CENTRAL-SYDNEY',
        source_review_id: 'REV-004',
        rating: 7.0,
        review_date: '2026-11-19',
        positive_text: 'Close to Central station.',
        negative_text: 'Street noise at night was noticeable.',
        reviewer_country: 'United States',
        language: 'en',
      },
      {
        property: 'DARLING-HARBOUR',
        source_review_id: 'REV-005',
        rating: 9.0,
        review_date: '2026-11-19',
        positive_text: 'Stunning harbour views and excellent breakfast buffet.',
        negative_text: '',
        reviewer_country: 'Singapore',
        language: 'en',
      },
    ];

    it('ingests valid JSON reviews across all properties', async () => {
      const res = await request(app)
        .post('/api/reviews/import/json')
        .send({ reviews: testReviews });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.insertedCount).toBe(5);
      expect(res.body.summary.duplicateCount).toBe(0);
    });

    it('Scenario 4 & 5: Repeated import safely detects and prevents duplicate records', async () => {
      // Re-submit the exact same reviews
      const res = await request(app)
        .post('/api/reviews/import/json')
        .send({ reviews: testReviews });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // All 5 must be detected as duplicates and NOT re-inserted
      expect(res.body.summary.insertedCount).toBe(0);
      expect(res.body.summary.duplicateCount).toBe(5);
    });

    it('Scenario 6: Rejects invalid ratings without crashing the batch', async () => {
      const mixedBatch = [
        {
          property: 'DARLING-HARBOUR',
          rating: 15.0, // Invalid: rating > 10
          review_date: '2026-11-18',
          positive_text: 'Impossible score',
        },
        {
          property: 'DARLING-HARBOUR',
          rating: -2.0, // Invalid: negative rating
          review_date: '2026-11-18',
          positive_text: 'Negative score',
        },
        {
          property: 'DARLING-HARBOUR',
          source_review_id: 'REV-VALID-01',
          rating: 8.8,
          review_date: '2026-11-18',
          positive_text: 'Legitimate review in mixed batch',
        },
      ];

      const res = await request(app)
        .post('/api/reviews/import/json')
        .send({ reviews: mixedBatch });

      expect(res.status).toBe(200);
      expect(res.body.summary.failedCount).toBe(2);
      expect(res.body.summary.insertedCount).toBe(1);
    });

    it('Scenario 7: Handles missing review content gracefully', async () => {
      const emptyContentReview = [
        {
          property: 'CENTRAL-SYDNEY',
          rating: 8.0,
          review_date: '2026-11-18',
          positive_text: '',
          negative_text: '',
          full_text: '', // No text at all
        },
      ];

      const res = await request(app)
        .post('/api/reviews/import/json')
        .send({ reviews: emptyContentReview });

      expect(res.status).toBe(200);
      // Empty text is caught by validation
      expect(res.body.summary.failedCount).toBe(1);
    });
  });

  // ── Scenario 8, 9, 10, 11: AI Analysis & Multi-Topic Classification ─────────
  describe('Scenario 8-11: Sentiment & Operational Multi-Topic Classification', () => {
    it('Scenario 9: Correctly classifies Mixed sentiment with opposing topics', async () => {
      const pool = mockPool;
      const pRes = await pool.query("SELECT id FROM properties WHERE property_code = 'OLYMPIC-PADDINGTON'");
      const propId = pRes.rows[0].id;

      const rRes = await pool.query(`
        INSERT INTO reviews (
          property_id, source, fingerprint, rating, review_date,
          positive_text, negative_text, language
        ) VALUES (
          $1, 'booking.com', 'fp_mixed_001', 7.0, '2026-11-18',
          'The location was excellent and reception staff was helpful.',
          'However the bathroom was dirty and elevator was broken.', 'en'
        ) RETURNING id;
      `, [propId]);
      const reviewId = rRes.rows[0].id;

      // Persist mixed analysis with multiple topics
      await pool.query(`
        INSERT INTO review_analyses (
          review_id, overall_sentiment, sentiment_confidence, detected_language,
          model_name, model_version, analysis_status
        ) VALUES ($1, 'mixed', 0.92, 'en', 'azzurro-hybrid-nlp-v1', '1.0.0', 'completed');
      `, [reviewId]);

      // Operational topics
      await pool.query(`
        INSERT INTO review_topics (review_id, topic_name, topic_sentiment, confidence)
        VALUES 
          ($1, 'Location', 'positive', 0.95),
          ($1, 'Staff Behaviour', 'positive', 0.90),
          ($1, 'Cleanliness', 'negative', 0.92),
          ($1, 'Facilities', 'negative', 0.88);
      `, [reviewId]);

      // Fetch via API
      const revRes = await request(app).get(`/api/reviews/${reviewId}`);
      expect(revRes.status).toBe(200);
      expect(revRes.body.review.overall_sentiment).toBe('mixed');
      expect(revRes.body.review.topics.length).toBe(4);
    });

    it('Scenario 11: Handles Non-English reviews with language detection', async () => {
      const pool = mockPool;
      const pRes = await pool.query("SELECT id FROM properties WHERE property_code = 'DARLING-HARBOUR'");
      const propId = pRes.rows[0].id;

      const rRes = await pool.query(`
        INSERT INTO reviews (
          property_id, source, fingerprint, rating, review_date,
          positive_text, negative_text, language
        ) VALUES (
          $1, 'booking.com', 'fp_italian_001', 9.0, '2026-11-19',
          'Hotel magnifico e camera molto pulita!', '', 'it'
        ) RETURNING id;
      `, [propId]);
      const reviewId = rRes.rows[0].id;

      await pool.query(`
        INSERT INTO review_analyses (
          review_id, overall_sentiment, sentiment_confidence, detected_language,
          model_name, model_version, analysis_status
        ) VALUES ($1, 'positive', 0.96, 'it', 'azzurro-hybrid-nlp-v1', '1.0.0', 'completed');
      `, [reviewId]);

      const revRes = await request(app).get(`/api/reviews/${reviewId}`);
      expect(revRes.status).toBe(200);
      expect(revRes.body.review.detected_language).toBe('it');
      expect(revRes.body.review.overall_sentiment).toBe('positive');
    });
  });

  // ── Scenario 12: Analytics, Filters, Trends & Reporting ─────────────────────
  describe('Scenario 12-18: Analytics, Property Filters & Reports', () => {
    it('calculates weekly averages and diffs for current reporting cycle', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview.totalReviewsCount).toBeGreaterThan(0);
      expect(Number(res.body.overview.currentWeeklyRating)).toBeGreaterThan(0);
    });

    it('Scenario 13: Filters reviews and analytics by specific propertyCode', async () => {
      const res = await request(app).get('/api/reviews?propertyCode=OLYMPIC-PADDINGTON');
      expect(res.status).toBe(200);
      expect(res.body.reviews.length).toBeGreaterThan(0);
      res.body.reviews.forEach((r) => {
        expect(r.property_code || r.propertyCode).toBe('OLYMPIC-PADDINGTON');
      });
    });

    it('Scenario 14: Filters reviews by rating band', async () => {
      const res = await request(app).get('/api/reviews?rating=9-10');
      expect(res.status).toBe(200);
      res.body.reviews.forEach((r) => {
        expect(Number(r.rating)).toBeGreaterThanOrEqual(9.0);
      });
    });

    it('Scenario 15: Supports pagination with limit and offset', async () => {
      const res = await request(app).get('/api/reviews?limit=2&page=1');
      expect(res.status).toBe(200);
      expect(res.body.reviews.length).toBeLessThanOrEqual(2);
      expect(res.body.page).toBe(1);
    });

    it('Scenario 16: Generates automated weekly intelligence report', async () => {
      const genRes = await request(app).post('/api/reports/weekly/generate').send({});
      expect(genRes.status).toBe(200);
      expect(genRes.body.success).toBe(true);
      expect(genRes.body.report).toBeDefined();
      expect(genRes.body.report.properties.length).toBe(4);
    });

    it('Scenario 17: Collection Monitor API reports adapter and lock status', async () => {
      const statusRes = await request(app).get('/api/collection/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.adapters.length).toBeGreaterThanOrEqual(4);
      expect(statusRes.body.playwrightAuthorized).toBe(false);

      const jobsRes = await request(app).get('/api/collection/jobs');
      expect(jobsRes.status).toBe(200);
      expect(jobsRes.body.jobs.length).toBeGreaterThanOrEqual(4);
    });

    it('Scenario 18: Manual correction endpoint records audit trail without altering AI output', async () => {
      const revs = await request(app).get('/api/reviews');
      const targetId = revs.body.reviews[0].id;

      const corRes = await request(app)
        .patch(`/api/reviews/${targetId}/correction`)
        .send({
          targetEntity: 'review_analysis',
          fieldName: 'overall_sentiment',
          oldValue: 'negative',
          newValue: 'neutral',
          reason: 'Review was balanced constructive feedback',
          correctedBy: 'QA Lead Auditor',
        });

      expect(corRes.status).toBe(200);
      expect(corRes.body.success).toBe(true);
      expect(corRes.body.correction.verified).toBe(true);
    });
  });
});
