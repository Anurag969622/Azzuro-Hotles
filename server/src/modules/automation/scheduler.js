'use strict';

const cron = require('node-cron');
const logger = require('../../config/logger');
const dbConn = require('../database/connection');
const jobLock = require('./jobLock');
const workflowEngine = require('./workflowEngine');

const DEFAULT_TIMEZONE = 'Australia/Sydney';

/**
 * Background Scheduler managing automated cron jobs in the Australia/Sydney timezone.
 * Handles job registration, locking, per-property triggers, and graceful shutdown.
 */
class Scheduler {
  constructor() {
    this.cronTasks = new Map();
    this.timezone = process.env.TIMEZONE || DEFAULT_TIMEZONE;
    this.isInitialized = false;
  }

  /**
   * Initializes all scheduled jobs with Australia/Sydney timezone.
   */
  async init(poolOverride = null) {
    if (this.isInitialized) {
      logger.info('[Scheduler] Already initialized.');
      return;
    }

    logger.info(`[Scheduler] Initializing automated job scheduler with timezone "${this.timezone}".`);

    // 1. Daily Multi-Property Collection (Default: 02:00 AM Sydney AEST)
    const dailyCron = process.env.COLLECTION_CRON_SCHEDULE || '0 2 * * *';
    this.registerJob('daily_collection_all', dailyCron, async () => {
      logger.info('[Scheduler] Triggering scheduled job "daily_collection_all"');
      await workflowEngine.runMultiPropertyWorkflow({
        poolOverride,
        source: process.env.DEFAULT_COLLECTION_SOURCE || 'booking',
      });
    });

    // 2. Weekly Reporting Aggregation Sync (Every Monday at 03:00 AM Sydney AEST)
    const weeklyCron = '0 3 * * 1';
    this.registerJob('weekly_analytics_reporting', weeklyCron, async () => {
      logger.info('[Scheduler] Triggering scheduled job "weekly_analytics_reporting"');
      const lock = await jobLock.acquire('weekly_analytics_reporting', { poolOverride });
      if (lock.acquired) {
        try {
          // Trigger weekly report generation
          const analyticsEngine = require('../analytics/analyticsEngine');
          await analyticsEngine.getOverview({ poolOverride });
          await lock.release('success', { note: 'Weekly analytics sync complete' });
        } catch (err) {
          await lock.release('failed', { error: err.message });
        }
      }
    });

    // 3. AI Queue Background Worker (Runs every 30 minutes)
    const queueCron = '*/30 * * * *';
    this.registerJob('ai_queue_processing', queueCron, async () => {
      logger.info('[Scheduler] Triggering recurring AI queue background worker');
      const lock = await jobLock.acquire('ai_queue_processing', { timeoutMs: 60000, poolOverride });
      if (lock.acquired) {
        try {
          const res = await workflowEngine.processAiQueue({ batchSize: 50, poolOverride });
          await lock.release('success', { processed: res.processed || 0 });
        } catch (err) {
          await lock.release('failed', { error: err.message });
        }
      }
    });

    // 4. Per-property isolated scheduled tasks
    const propertyJobs = [
      { code: 'OLYMPIC-PADDINGTON', name: 'property_collection_olympic_paddington', cron: '0 2 * * *' },
      { code: 'POTTS-POINT', name: 'property_collection_potts_point', cron: '10 2 * * *' },
      { code: 'CENTRAL-SYDNEY', name: 'property_collection_central_sydney', cron: '20 2 * * *' },
      { code: 'DARLING-HARBOUR', name: 'property_collection_darling_harbour', cron: '30 2 * * *' },
    ];

    for (const p of propertyJobs) {
      this.registerJob(p.name, p.cron, async () => {
        logger.info(`[Scheduler] Triggering per-property scheduled job "${p.name}"`);
        const lock = await jobLock.acquire(p.name, { poolOverride });
        if (lock.acquired) {
          try {
            const outcome = await workflowEngine.executePropertyWorkflow(p.code, {
              poolOverride,
              source: process.env.DEFAULT_COLLECTION_SOURCE || 'booking',
            });
            await lock.release(outcome.status, outcome);
          } catch (err) {
            await lock.release('failed', { error: err.message });
          }
        }
      });
    }

    this.isInitialized = true;
    logger.info(`[Scheduler] Successfully registered ${this.cronTasks.size} automated jobs.`);
  }

  /**
   * Registers a single cron job with timezone configuration.
   */
  registerJob(jobName, cronExpression, taskFn) {
    if (this.cronTasks.has(jobName)) {
      this.cronTasks.get(jobName).stop();
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          await taskFn();
        } catch (err) {
          logger.error(`[Scheduler] Error executing task "${jobName}": ${err.message}`, {
            error: err.message,
            stack: err.stack,
          });
        }
      },
      {
        scheduled: true,
        timezone: this.timezone,
      }
    );

    this.cronTasks.set(jobName, {
      jobName,
      cronExpression,
      task,
      taskFn,
      isActive: true,
      lastTriggeredAt: null,
    });

    logger.debug(`[Scheduler] Registered "${jobName}" [${cronExpression}] in timezone "${this.timezone}".`);
  }

  /**
   * Manually triggers a job on demand (manual execution).
   */
  async triggerJob(jobName, options = {}) {
    logger.info(`[Scheduler] Manual on-demand trigger requested for "${jobName}".`);

    if (jobName === 'daily_collection_all') {
      return await workflowEngine.runMultiPropertyWorkflow(options);
    }

    if (jobName === 'ai_queue_processing') {
      return await workflowEngine.processAiQueue(options);
    }

    // Check if it's a registered property job or custom job
    const registered = this.cronTasks.get(jobName);
    if (registered && registered.taskFn) {
      const lock = await jobLock.acquire(jobName, options);
      if (!lock.acquired) {
        return { success: false, reason: lock.reason };
      }
      try {
        const result = await registered.taskFn();
        await lock.release('success');
        return { success: true, result };
      } catch (err) {
        await lock.release('failed', { error: err.message });
        throw err;
      }
    }

    // Fallback: Check if it corresponds to a propertyCode directly
    if (options.propertyCode) {
      return await workflowEngine.executePropertyWorkflow(options.propertyCode, options);
    }

    throw new Error(`Job "${jobName}" is not registered in scheduler.`);
  }

  /**
   * Toggles a job on or off (pauses or resumes cron scheduling).
   */
  toggleJob(jobName, isActive) {
    const entry = this.cronTasks.get(jobName);
    if (!entry) {
      throw new Error(`Job "${jobName}" not found.`);
    }

    if (isActive) {
      entry.task.start();
      entry.isActive = true;
      logger.info(`[Scheduler] Resumed job "${jobName}".`);
    } else {
      entry.task.stop();
      entry.isActive = false;
      logger.info(`[Scheduler] Paused job "${jobName}".`);
    }

    return { jobName, isActive: entry.isActive };
  }

  /**
   * Returns comprehensive status of all scheduled jobs and AI queue.
   */
  async getStatus(poolOverride = null) {
    const pool = poolOverride || dbConn.getPool();
    const queueStatus = await workflowEngine.getQueueStatus(pool);
    const activeLocks = jobLock.listLocks();

    let dbJobs = [];
    if (pool) {
      try {
        const res = await pool.query('SELECT * FROM scheduled_jobs ORDER BY created_at ASC');
        dbJobs = res.rows;
      } catch (err) {
        logger.debug(`Could not read scheduled_jobs table: ${err.message}`);
      }
    }

    // Merge in-memory registered tasks with DB records
    const jobs = Array.from(this.cronTasks.values()).map((t) => {
      const dbRecord = dbJobs.find((dj) => dj.job_name === t.jobName) || {};
      const isLocked = jobLock.isLocked(t.jobName);

      return {
        jobName: t.jobName,
        cronExpression: t.cronExpression,
        isActive: t.isActive,
        timezone: this.timezone,
        isLocked,
        lastStatus: isLocked ? 'running' : dbRecord.last_status || 'idle',
        lastRunAt: dbRecord.last_run_at || null,
        failureCount: dbRecord.failure_count || 0,
        metadata: dbRecord.metadata || {},
      };
    });

    return {
      schedulerActive: this.isInitialized,
      timezone: this.timezone,
      totalRegisteredJobs: this.cronTasks.size,
      activeLocksCount: activeLocks.length,
      activeLocks,
      aiQueue: queueStatus,
      jobs,
    };
  }

  /**
   * Gracefully stops all active cron jobs and releases remaining locks.
   */
  stop() {
    logger.info('[Scheduler] Stopping all cron tasks for graceful shutdown.');
    for (const [name, entry] of this.cronTasks.entries()) {
      entry.task.stop();
    }
    this.cronTasks.clear();
    jobLock.forceReleaseAll();
    this.isInitialized = false;
    logger.info('[Scheduler] All background jobs stopped cleanly.');
  }
}

if (!global.__azzurro_scheduler__) {
  global.__azzurro_scheduler__ = new Scheduler();
}

module.exports = global.__azzurro_scheduler__;
