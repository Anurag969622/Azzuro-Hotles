'use strict';

const os = require('os');
const http = require('http');
const { Router } = require('express');
const { getAdminClient } = require('../../config/supabase');
const { AI_SERVICE_URL, NODE_ENV, SUPABASE_URL } = require('../../config/env');
const logger = require('../../config/logger');

const router = Router();

/** Checks AI worker reachability with a timeout */
function pingAiWorker() {
  return new Promise((resolve) => {
    const url = new URL('/health', AI_SERVICE_URL);
    const req = http.get({ hostname: url.hostname, port: url.port || 8001, path: url.pathname, timeout: 2500 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve({ reachable: res.statusCode === 200, status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ reachable: res.statusCode === 200, status: res.statusCode }); }
      });
    });
    req.on('error', (e) => resolve({ reachable: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ reachable: false, error: 'timeout' }); });
  });
}

/** Checks Supabase/DB reachability with timeout */
async function pingDatabase() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-ref')) {
    return { connected: false, note: 'SUPABASE_URL placeholder set — configure real project in server/.env' };
  }
  try {
    const client = getAdminClient();
    if (!client) return { connected: false, note: 'Supabase client not initialised' };
    
    // Use AbortController for strict timeout on DB ping so health check stays snappy
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const { error } = await client.from('properties').select('id').limit(1).abortSignal(controller.signal);
    clearTimeout(timeoutId);

    if (error && error.code === '42P01') {
      // Table doesn't exist yet — DB connected but schema not applied
      return { connected: true, note: 'DB reachable — schema not yet applied (Phase 3)' };
    }
    if (error) return { connected: false, error: error.message };
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.name === 'AbortError' ? 'timeout (2000ms)' : err.message };
  }
}

/**
 * GET /api/v1/health
 * Full health check: server, database, AI worker.
 */
router.get('/', async (req, res) => {
  const start = Date.now();

  const [dbStatus, aiStatus] = await Promise.all([pingDatabase(), pingAiWorker()]);

  const payload = {
    success: true,
    service: 'azzurro-insights-server',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    system: {
      platform: os.platform(),
      node_version: process.version,
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    checks: {
      server: { status: 'ok' },
      database: dbStatus.connected === false
        ? { status: 'degraded', ...dbStatus }
        : { status: 'ok', ...dbStatus },
      ai_worker: aiStatus.reachable
        ? { status: 'ok', ...aiStatus }
        : { status: 'degraded', ...aiStatus },
    },
    response_ms: Date.now() - start,
  };

  logger.debug('Health check completed', { checks: payload.checks });
  res.status(200).json(payload);
});

/**
 * GET /api/v1/health/ping
 * Ultra-lightweight liveness probe (no external checks).
 */
router.get('/ping', (req, res) => {
  res.status(200).json({ success: true, pong: true, ts: Date.now() });
});

module.exports = router;

