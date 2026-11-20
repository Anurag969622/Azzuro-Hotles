import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('GET /api/v1/health/ping', () => {
  it('responds 200 with pong', async () => {
    const res = await request(app).get('/api/v1/health/ping');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pong).toBe(true);
    expect(typeof res.body.ts).toBe('number');
  });
});

describe('GET /api/v1/health', () => {
  it('responds 200 with service info', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('azzurro-insights-server');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.server.status).toBe('ok');
  }, 10000);

  it('contains system metadata', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.system).toBeDefined();
    expect(res.body.system.node_version).toMatch(/^v\d+/);
    expect(typeof res.body.uptime_seconds).toBe('number');
  }, 10000);
});

describe('GET /api/v1', () => {
  it('returns API root info', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('v1');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

