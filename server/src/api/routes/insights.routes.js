'use strict';

const { Router } = require('express');
const insightsEngine = require('../../modules/analytics/insightsEngine');

const router = Router();

/**
 * GET /api/insights
 * Generates verified operational insights backed by direct review evidence.
 */
router.get('/', async (req, res, next) => {
  try {
    const insights = await insightsEngine.getInsights();
    res.json({
      success: true,
      count: insights.length,
      insights,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/insights/:id/evidence
 * Returns all supporting review IDs, dates, ratings, and quotes for a given insight.
 */
router.get('/:id/evidence', async (req, res, next) => {
  try {
    const { id } = req.params;
    const evidence = await insightsEngine.getInsightEvidence(id);
    res.json({
      success: true,
      insightId: id,
      count: evidence.length,
      evidence,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

