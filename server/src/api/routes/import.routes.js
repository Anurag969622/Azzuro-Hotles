'use strict';

const { Router } = require('express');
const multer = require('multer');
const { parseCsv } = require('../../modules/collection/csvParser');
const { parseJson } = require('../../modules/collection/jsonParser');
const ingestionService = require('../../modules/collection/ingestionService');
const { importLimiter } = require('../middleware/rateLimiter');
const { generateSyntheticReviews } = require('../../modules/collection/syntheticDataGenerator');
const { CollectionAdapterManager } = require('../../modules/collection/collectionAdapter');
const { getPool } = require('../../modules/database/connection');

const router = Router();
const adapterManager = new CollectionAdapterManager();

// Memory-safe multer storage, 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * GET /api/v1/import/adapters
 * Lists collection adapters and their availability status.
 */
router.get('/adapters', (req, res) => {
  res.json({
    success: true,
    adapters: adapterManager.listAdapters(),
  });
});

/**
 * POST /api/v1/import/csv/preview
 * Parses CSV and returns preview rows, detected headers, and validation errors
 * without persisting to the database.
 */
router.post('/csv/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No CSV file uploaded' } });
    }

    const { defaultPropertyCode } = req.body;
    const { validRecords, failedRows, headers, detectedMapping } = await parseCsv(req.file.buffer, {
      defaultPropertyCode,
    });

    res.json({
      success: true,
      fileName: req.file.originalname,
      totalRows: validRecords.length + failedRows.length,
      validCount: validRecords.length,
      failedCount: failedRows.length,
      headers,
      detectedMapping,
      preview: validRecords.slice(0, 5),
      failedPreview: failedRows.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/import/csv
 * Ingests CSV file and commits valid reviews to database.
 */
router.post('/csv', importLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No CSV file uploaded' } });
    }

    const { defaultPropertyCode } = req.body;
    const { validRecords, failedRows } = await parseCsv(req.file.buffer, {
      defaultPropertyCode,
    });

    const summary = await ingestionService.ingestRecords({
      records: validRecords,
      failedRows,
      source: 'csv_import',
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      propertyCode: defaultPropertyCode,
    });

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/import/json
 * Ingests JSON payload (either file or JSON body).
 */
router.post('/json', importLimiter, upload.single('file'), async (req, res, next) => {
  try {
    let payload;
    let fileName = 'payload.json';
    let fileSizeBytes = 0;

    if (req.file) {
      payload = req.file.buffer;
      fileName = req.file.originalname;
      fileSizeBytes = req.file.size;
    } else if (req.body && (req.body.reviews || Array.isArray(req.body))) {
      payload = req.body.reviews || req.body;
      fileSizeBytes = JSON.stringify(payload).length;
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Provide either a JSON file upload or a JSON body containing a reviews array' },
      });
    }

    const { defaultPropertyCode } = req.body;
    const { validRecords, failedRows } = parseJson(payload, { defaultPropertyCode });

    const summary = await ingestionService.ingestRecords({
      records: validRecords,
      failedRows,
      source: 'json_import',
      fileName,
      fileSizeBytes,
      propertyCode: defaultPropertyCode,
    });

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/import/synthetic
 * Generates synthetic demonstration reviews and imports them.
 */
router.post('/synthetic', importLimiter, async (req, res, next) => {
  try {
    const count = parseInt(req.body.count || 200, 10);
    const reviews = generateSyntheticReviews(count);

    const { validRecords, failedRows } = parseJson(reviews);
    const summary = await ingestionService.ingestRecords({
      records: validRecords,
      failedRows,
      source: 'json_import',
      fileName: `synthetic_${count}_reviews.json`,
      fileSizeBytes: JSON.stringify(reviews).length,
    });

    res.status(200).json({
      success: true,
      message: `Generated and ingested ${summary.insertedCount} synthetic reviews.`,
      disclaimer: 'SYNTHETIC TEST DATA - Not collected from Booking.com',
      summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/import/batches
 * Returns recent import batches and collection logs.
 */
router.get('/batches', async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.json({ success: true, batches: [], note: 'Database pool not active' });
    }

    const { rows } = await pool.query(`
      SELECT b.*, p.name as property_name, p.property_code
      FROM collection_batches b
      LEFT JOIN properties p ON b.property_id = p.id
      ORDER BY b.created_at DESC
      LIMIT 50;
    `);

    res.json({ success: true, batches: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/import/logs
 * Returns collection logs history.
 */
router.get('/logs', async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.json({ success: true, logs: [], note: 'Database pool not active' });
    }

    const { rows } = await pool.query(`
      SELECT l.*, p.name as property_name
      FROM collection_logs l
      LEFT JOIN properties p ON l.property_id = p.id
      ORDER BY l.started_at DESC
      LIMIT 50;
    `);

    res.json({ success: true, logs: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

