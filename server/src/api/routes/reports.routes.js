'use strict';

const { Router } = require('express');
const analyticsEngine = require('../../modules/analytics/analyticsEngine');
const insightsEngine = require('../../modules/analytics/insightsEngine');
const dbConn = require('../../modules/database/connection');

const router = Router();

/**
 * GET /api/reports/weekly
 * Returns structured weekly intelligence report for the portfolio.
 */
router.get('/weekly', async (req, res, next) => {
  try {
    const [overview, properties, topics, insights] = await Promise.all([
      analyticsEngine.getOverview({ referenceDate: req.query.date }),
      analyticsEngine.getPropertyAnalytics(),
      analyticsEngine.getTopicAnalytics(),
      insightsEngine.getInsights(),
    ]);

    const report = {
      reportTitle: 'Azzurro Hotels — Weekly Review Intelligence Briefing',
      generatedAt: new Date().toISOString(),
      reportingPeriod: overview.period,
      executiveSummary: {
        portfolioAverageRating: overview.kpis.currentWeekAverageRating,
        previousWeekRating: overview.kpis.previousWeekAverageRating,
        ratingDelta: overview.kpis.ratingDifference,
        ratingTrend: overview.kpis.ratingTrend,
        weeklyReviewVolume: overview.kpis.currentWeekReviewCount,
        sentimentBreakdown: overview.sentimentDistribution.percentages,
      },
      propertyRankings: properties.map(p => ({
        property: p.name,
        code: p.property_code,
        avgRating: p.avg_rating,
        reviewCount: p.review_count,
        positivePercentage: p.sentimentPercentages.positive,
        negativePercentage: p.sentimentPercentages.negative,
      })),
      topOperationalComplaints: topics.mostCommonComplaints,
      strategicInsights: insights,
    };

    res.json({
      success: true,
      report,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/weekly/generate
 * Generates and archives a weekly briefing snapshot.
 */
router.post('/weekly/generate', async (req, res, next) => {
  try {
    const pool = dbConn.getPool();
    const overview = await analyticsEngine.getOverview({ referenceDate: req.body.date });
    const properties = await analyticsEngine.getPropertyAnalytics();
    const topics = await analyticsEngine.getTopicAnalytics();
    const insights = await insightsEngine.getInsights();

    const reportData = {
      generatedAt: new Date().toISOString(),
      overview,
      properties,
      topics,
      insights,
    };

    // If database connection active, log report generation job
    if (pool) {
      await pool.query(`
        INSERT INTO scheduled_jobs (
          job_name, job_type, cron_expression, last_run_at, last_status, metadata
        ) VALUES (
          $1, 'weekly_report_generator', '0 0 * * MON', NOW(), 'success', $2
        )
        ON CONFLICT (job_name) DO UPDATE SET
          last_run_at = NOW(),
          last_status = 'success',
          metadata = EXCLUDED.metadata;
      `, [`weekly_report_${overview.period.currentWeek.startDate}`, JSON.stringify(reportData)]);
    }

    res.json({
      success: true,
      message: 'Weekly intelligence report generated successfully.',
      reportId: `REP-WEEKLY-${overview.period.currentWeek.startDate}`,
      period: overview.period,
      report: reportData,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

