'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { CORS_ORIGIN, NODE_ENV } = require('./config/env');
const requestLogger = require('./api/middleware/requestLogger');
const { apiLimiter } = require('./api/middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./api/middleware/errorHandler');
const healthRoutes = require('./api/routes/health.routes');
const importRoutes = require('./api/routes/import.routes');
const analysisRoutes = require('./api/routes/analysis.routes');
const propertiesRoutes = require('./api/routes/properties.routes');
const reviewsRoutes = require('./api/routes/reviews.routes');
const analyticsRoutes = require('./api/routes/analytics.routes');
const insightsRoutes = require('./api/routes/insights.routes');
const collectionRoutes = require('./api/routes/collection.routes');
const reportsRoutes = require('./api/routes/reports.routes');

const app = express();

// ── Security Headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin in prod)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
}));

// ── Body Parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Request Logging ────────────────────────────────────────────────────────────
if (NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
// Versioned /api/v1 routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/properties', propertiesRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/collection', collectionRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Unversioned /api alias routes (matching exact specification)
app.use('/api/properties', propertiesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/reports', reportsRoutes);

// Placeholder route — additional routes mounted in Phase 5
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    message: 'Azzurro Insights API',
    version: 'v1',
    docs: '/api/v1/health',
  });
});

// ── 404 & Error Handling ───────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

