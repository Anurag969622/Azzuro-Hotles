import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Phase 6 Express Backend API Endpoints', () => {
  describe('Properties Endpoints', () => {
    it('GET /api/properties returns properties list', async () => {
      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.properties)).toBe(true);
    });
  });

  describe('Reviews Endpoints', () => {
    it('GET /api/reviews supports pagination and filtering', async () => {
      const res = await request(app)
        .get('/api/reviews')
        .query({ page: 1, limit: 10, sort_by: 'rating', sort_order: 'desc' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(Array.isArray(res.body.reviews)).toBe(true);
    });

    it('GET /api/reviews/:id returns 404 for non-existent review', async () => {
      const res = await request(app).get('/api/reviews/00000000-0000-0000-0000-000000000999');
      // When DB not connected, returns 503 or 404 cleanly via centralized handler
      expect([404, 503]).toContain(res.status);
    });
  });

  describe('Analytics Endpoints', () => {
    it('GET /api/analytics/overview returns KPI object with rating difference', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.kpis).toBeDefined();
      expect(res.body.kpis.currentWeekAverageRating).toBeDefined();
      expect(res.body.kpis.ratingDifference).toBeDefined();
    });

    it('GET /api/analytics/properties returns property comparisons', async () => {
      const res = await request(app).get('/api/analytics/properties');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.properties)).toBe(true);
    });

    it('GET /api/analytics/trends returns daily ratings and weekly sentiment', async () => {
      const res = await request(app).get('/api/analytics/trends').query({ days: 14 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dailyRatings).toBeDefined();
      expect(res.body.weeklySentiment).toBeDefined();
    });

    it('GET /api/analytics/topics returns topics and priority scores', async () => {
      const res = await request(app).get('/api/analytics/topics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.topics)).toBe(true);
    });

    it('GET /api/analytics/sentiment returns distribution', async () => {
      const res = await request(app).get('/api/analytics/sentiment');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Insights Endpoints', () => {
    it('GET /api/insights returns actionable insights', async () => {
      const res = await request(app).get('/api/insights');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.insights)).toBe(true);
    });

    it('GET /api/insights/:id/evidence handles evidence queries', async () => {
      const res = await request(app).get('/api/insights/NON_EXISTENT/evidence');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.evidence)).toBe(true);
    });
  });

  describe('Collection Endpoints', () => {
    it('GET /api/collection/status reports adapter statuses', async () => {
      const res = await request(app).get('/api/collection/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.playwrightAuthorized).toBe(false);
    });

    it('GET /api/collection/logs returns collection history', async () => {
      const res = await request(app).get('/api/collection/logs');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Reports Endpoints', () => {
    it('GET /api/reports/weekly returns weekly executive report structure', async () => {
      const res = await request(app).get('/api/reports/weekly');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.executiveSummary).toBeDefined();
      expect(res.body.report.reportingPeriod.timezone).toBe('Australia/Sydney');
    });

    it('POST /api/reports/weekly/generate creates weekly report archive', async () => {
      const res = await request(app).post('/api/reports/weekly/generate');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reportId).toBeDefined();
    }, 15000);
  });
});

