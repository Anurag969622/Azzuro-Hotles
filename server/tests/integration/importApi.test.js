import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import path from 'path';

describe('Import & Collection API Integration Tests', () => {
  it('GET /api/v1/import/adapters returns all available adapters and statuses', async () => {
    const res = await request(app).get('/api/v1/import/adapters');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.adapters)).toBe(true);
    const pwAdapter = res.body.adapters.find(a => a.name === 'playwright_authorized');
    expect(pwAdapter).toBeDefined();
    expect(pwAdapter.enabled).toBe(false);
  });

  it('POST /api/v1/import/csv/preview previews CSV without database write', async () => {
    const csvContent = 'hotel,rating,review_date,positive_text\nOlympic Hotel Paddington,9.5,2026-03-01,Fantastic stay!';
    
    const res = await request(app)
      .post('/api/v1/import/csv/preview')
      .attach('file', Buffer.from(csvContent, 'utf8'), 'test_preview.csv');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validCount).toBe(1);
    expect(res.body.failedCount).toBe(0);
    expect(res.body.preview[0].property_code).toBe('OLYMPIC-PADDINGTON');
    expect(res.body.preview[0].rating).toBe(9.5);
  });

  it('POST /api/v1/import/json ingests JSON review array', async () => {
    const jsonReviews = [
      {
        property: 'Venus Potts Point',
        rating: 8.8,
        review_date: '2026-03-05',
        positive_text: 'Charming boutique hotel',
        negative_text: 'Steep hill',
      },
    ];

    const res = await request(app)
      .post('/api/v1/import/json')
      .send({ reviews: jsonReviews });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalSubmitted).toBe(1);
    expect(res.body.summary.parsedCount).toBe(1);
  }, 15000);

  it('POST /api/v1/import/synthetic generates and ingests synthetic demo reviews', async () => {
    const res = await request(app)
      .post('/api/v1/import/synthetic')
      .send({ count: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disclaimer).toContain('SYNTHETIC TEST DATA');
    expect(res.body.summary.totalSubmitted).toBe(50);
  }, 35000);

  it('GET /api/v1/import/batches and logs return cleanly', async () => {
    const resBatches = await request(app).get('/api/v1/import/batches');
    expect(resBatches.status).toBe(200);
    expect(resBatches.body.success).toBe(true);

    const resLogs = await request(app).get('/api/v1/import/logs');
    expect(resLogs.status).toBe(200);
    expect(resLogs.body.success).toBe(true);
  });
});

