'use strict';

const { Router } = require('express');
const analyticsEngine = require('../../modules/analytics/analyticsEngine');

const router = Router();

/**
 * GET /api/analytics/overview
 * Weekly ratings, difference, total count, and sentiment percentages.
 */
router.get('/overview', async (req, res, next) => {
  try {
    const data = await analyticsEngine.getOverview({
      referenceDate: req.query.date,
    });

    const overviewSummary = {
      currentWeeklyRating: data.kpis.currentWeekAverageRating,
      previousWeeklyRating: data.kpis.previousWeekAverageRating,
      ratingDiff: data.kpis.ratingDifference,
      totalReviewsCount: data.kpis.totalReviewCount,
      sentimentBreakdown: {
        positive: data.sentimentDistribution.counts.positive,
        negative: data.sentimentDistribution.counts.negative,
        mixed: data.sentimentDistribution.counts.mixed,
        neutral: data.sentimentDistribution.counts.neutral,
        positivePct: data.sentimentDistribution.percentages.positive,
        negativePct: data.sentimentDistribution.percentages.negative,
        mixedPct: data.sentimentDistribution.percentages.mixed,
        neutralPct: data.sentimentDistribution.percentages.neutral,
      },
    };

    res.json({
      success: true,
      ...data,
      overview: overviewSummary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/properties
 * Property-wise ratings, review volume, and sentiment percentages.
 */
router.get('/properties', async (req, res, next) => {
  try {
    const properties = await analyticsEngine.getPropertyAnalytics();
    res.json({ success: true, count: properties.length, properties });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/trends
 * Daily rating trends and weekly sentiment trends.
 */
router.get('/trends', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || 30, 10);
    const data = await analyticsEngine.getTrends({ days });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/topics
 * Multi-label operational topic trends, complaint percentages, and priority scores.
 */
router.get('/topics', async (req, res, next) => {
  try {
    const data = await analyticsEngine.getTopicAnalytics();
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/sentiment
 * Comprehensive sentiment distribution by portfolio and by property.
 */
router.get('/sentiment', async (req, res, next) => {
  try {
    const data = await analyticsEngine.getSentimentAnalytics();
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

