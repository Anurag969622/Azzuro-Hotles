'use strict';

const { Router } = require('express');
const analysisService = require('../../modules/analytics/analysisService');
const { getPool } = require('../../modules/database/connection');

const router = Router();

/**
 * POST /api/v1/analysis/process-batch
 * Triggers batch analysis of unanalyzed reviews.
 */
router.post('/process-batch', async (req, res, next) => {
  try {
    const batchSize = parseInt(req.body.batchSize || 50, 10);
    const reanalyzeAll = Boolean(req.body.reanalyzeAll);

    const summary = await analysisService.processBatch({ batchSize, reanalyzeAll });
    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/analysis/correction
 * Records a human correction without altering original AI prediction.
 */
router.post('/correction', async (req, res, next) => {
  try {
    const { reviewId, targetEntity, fieldName, oldValue, newValue, reason, correctedBy } = req.body;

    if (!reviewId || !targetEntity || !fieldName || !newValue || !reason || !correctedBy) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required correction fields' },
      });
    }

    const result = await analysisService.recordCorrection({
      reviewId,
      targetEntity,
      fieldName,
      oldValue,
      newValue,
      reason,
      correctedBy,
    });

    res.json({
      success: true,
      correction: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analysis/corrections
 * Lists recorded manual corrections.
 */
router.get('/corrections', async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.json({ success: true, corrections: [] });
    }

    const { rows } = await pool.query(`
      SELECT mc.*, r.full_text as review_text, p.name as property_name
      FROM manual_corrections mc
      JOIN reviews r ON mc.review_id = r.id
      JOIN properties p ON r.property_id = p.id
      ORDER BY mc.created_at DESC
      LIMIT 100;
    `);

    res.json({
      success: true,
      corrections: rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

