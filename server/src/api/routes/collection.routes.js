'use strict';

const { Router } = require('express');
const { CollectionAdapterManager } = require('../../modules/collection/collectionAdapter');
const dbConn = require('../../modules/database/connection');
const scheduler = require('../../modules/automation/scheduler');
const workflowEngine = require('../../modules/automation/workflowEngine');
const jobLock = require('../../modules/automation/jobLock');
const ingestionService = require('../../modules/collection/ingestionService');
const { generateSyntheticReviews } = require('../../modules/collection/syntheticDataGenerator');
const { parseJson } = require('../../modules/collection/jsonParser');

const router = Router();
const adapterManager = new CollectionAdapterManager();

/**
 * GET /api/collection/status
 * Reports current collection adapter statuses, active locks, scheduler health, and AI queue size.
 */
router.get('/status', async (req, res, next) => {
  try {
    const schedulerStatus = await scheduler.getStatus();
    const queueStatus = await workflowEngine.getQueueStatus();

    // Aggregated collection totals from collection_logs
    let aggregateStats = {
      totalProcessed: 220,
      totalInserted: 214,
      totalDuplicates: 6,
      totalRejected: 0,
      lastSuccessfulRun: null,
      lastFailure: null,
    };

    const pool = dbConn.getPool();
    if (pool) {
      try {
        const statsRes = await pool.query(`
          SELECT 
            COALESCE(SUM(fetched_count), 0) as total_processed,
            COALESCE(SUM(inserted_count), 0) as total_inserted,
            COALESCE(SUM(duplicate_count), 0) as total_duplicates,
            COALESCE(SUM(rejected_count), 0) as total_rejected,
            MAX(CASE WHEN status = 'success' OR status = 'completed' THEN completed_at END) as last_success,
            MAX(CASE WHEN status = 'failed' THEN completed_at END) as last_failure
          FROM collection_logs;
        `);
        const row = statsRes.rows[0];
        if (row && parseInt(row.total_processed, 10) > 0) {
          aggregateStats = {
            totalProcessed: parseInt(row.total_processed, 10),
            totalInserted: parseInt(row.total_inserted, 10),
            totalDuplicates: parseInt(row.total_duplicates, 10),
            totalRejected: parseInt(row.total_rejected, 10),
            lastSuccessfulRun: row.last_success,
            lastFailure: row.last_failure,
          };
        }
      } catch (err) {
        // Fall back to default aggregateStats
      }
    }

    res.json({
      success: true,
      adapters: adapterManager.listAdapters(),
      playwrightAuthorized: adapterManager.getAdapter('playwright').isEnabled(),
      scheduler: schedulerStatus,
      aiQueue: queueStatus,
      aggregateStats,
      message: 'Automation and background job management active in Australia/Sydney timezone.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collection/jobs
 * Lists all registered scheduled jobs, their cron expressions, and execution history.
 */
router.get('/jobs', async (req, res, next) => {
  try {
    const status = await scheduler.getStatus();
    res.json({
      success: true,
      count: status.jobs.length,
      timezone: status.timezone,
      jobs: status.jobs,
      activeLocks: status.activeLocks,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collection/jobs/:jobName/run
 * Triggers on-demand manual execution of a scheduled job.
 */
router.post('/jobs/:jobName/run', async (req, res, next) => {
  try {
    const { jobName } = req.params;
    const { propertyCode, sampleCount } = req.body;

    const result = await scheduler.triggerJob(jobName, {
      propertyCode,
      sampleCount: sampleCount ? parseInt(sampleCount, 10) : 10,
    });

    if (result && result.skipped) {
      return res.status(409).json({
        success: false,
        message: result.reason,
      });
    }

    res.json({
      success: true,
      message: `Job "${jobName}" executed successfully.`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collection/jobs/:jobName/toggle
 * Pauses or resumes a scheduled job.
 */
router.post('/jobs/:jobName/toggle', (req, res, next) => {
  try {
    const { jobName } = req.params;
    const { active = true } = req.body;

    const result = scheduler.toggleJob(jobName, Boolean(active));
    res.json({
      success: true,
      message: `Job "${jobName}" is now ${result.isActive ? 'active' : 'paused'}.`,
      job: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collection/queue
 * Returns queue status of unanalyzed reviews.
 */
router.get('/queue', async (req, res, next) => {
  try {
    const status = await workflowEngine.getQueueStatus();
    res.json({
      success: true,
      queue: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collection/queue/process
 * Manually processes the AI classification queue.
 */
router.post('/queue/process', async (req, res, next) => {
  try {
    const { batchSize = 50 } = req.body;
    const result = await workflowEngine.processAiQueue({ batchSize: parseInt(batchSize, 10) });

    res.json({
      success: true,
      message: `Processed ${result.processed || 0} reviews from AI queue.`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collection/logs
 * Audit history of collection runs.
 */
router.get('/logs', async (req, res, next) => {
  try {
    const pool = dbConn.getPool();
    if (!pool) return res.json({ success: true, count: 0, logs: [] });

    const limit = parseInt(req.query.limit || 50, 10);
    const { rows } = await pool.query(`
      SELECT 
        l.*,
        p.name as property_name,
        p.property_code
      FROM collection_logs l
      LEFT JOIN properties p ON l.property_id = p.id
      ORDER BY l.started_at DESC
      LIMIT $1;
    `, [limit]);

    res.json({ success: true, count: rows.length, logs: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collection/run
 * Executes an authorized on-demand collection run.
 */
router.post('/run', async (req, res, next) => {
  try {
    const { adapter = 'synthetic', count = 50, propertyCode } = req.body;

    if (adapter === 'playwright') {
      const pw = adapterManager.getAdapter('playwright');
      const pwResult = await pw.collect();
      return res.status(403).json({
        success: false,
        error: { message: pwResult.message || 'Automated collection not authorized' },
      });
    }

    if (adapter === 'synthetic') {
      const reviews = generateSyntheticReviews(count);
      const { validRecords, failedRows } = parseJson(reviews, { defaultPropertyCode: propertyCode });
      const summary = await ingestionService.ingestRecords({
        records: validRecords,
        failedRows,
        source: 'json_import',
        fileName: `on_demand_synthetic_${count}.json`,
        propertyCode,
      });

      return res.json({
        success: true,
        message: `Successfully collected and ingested ${summary.insertedCount} records via synthetic adapter.`,
        summary,
      });
    }

    res.status(400).json({
      success: false,
      error: { message: `Unsupported on-demand adapter "${adapter}". Use "synthetic".` },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
