'use strict';

const logger = require('../../config/logger');
const dbConn = require('../database/connection');

/**
 * JobLock manages mutual exclusion for background jobs.
 * Prevents overlapping executions of recurring collection and analysis tasks.
 * Uses in-memory state with automatic timeout expiration and synchronizes with PostgreSQL scheduled_jobs.
 */
class JobLock {
  constructor() {
    this.locks = new Map();
    this.defaultTimeoutMs = 5 * 60 * 1000; // 5 minutes max lock duration
  }

  /**
   * Checks whether a job is currently locked.
   * Expired locks are automatically released.
   */
  isLocked(jobName) {
    const existing = this.locks.get(jobName);
    if (!existing) return false;

    if (Date.now() > existing.expiresAt) {
      logger.warn(`Lock on "${jobName}" expired after ${existing.timeoutMs}ms. Auto-releasing.`);
      this.locks.delete(jobName);
      return false;
    }
    return true;
  }

  /**
   * Attempts to acquire an exclusive lock for jobName.
   * 
   * @param {string} jobName - Identifier of the job
   * @param {Object} [options]
   * @param {number} [options.timeoutMs=300000] - Lock expiration in ms
   * @param {string} [options.holder='scheduler'] - Who requested the lock
   * @param {Object} [options.poolOverride]
   * @returns {Promise<{ acquired: boolean, release?: Function, reason?: string, lockInfo?: Object }>}
   */
  async acquire(jobName, options = {}) {
    const { timeoutMs = this.defaultTimeoutMs, holder = 'scheduler', poolOverride } = options;

    if (this.isLocked(jobName)) {
      const lock = this.locks.get(jobName);
      return {
        acquired: false,
        reason: `Job "${jobName}" is currently running and locked by ${lock.holder} until ${new Date(lock.expiresAt).toISOString()}.`,
        lockInfo: lock,
      };
    }

    const acquiredAt = Date.now();
    const expiresAt = acquiredAt + timeoutMs;
    const lockInfo = {
      jobName,
      holder,
      acquiredAt,
      expiresAt,
      timeoutMs,
    };

    this.locks.set(jobName, lockInfo);

    // Sync status to database if pool is available
    const pool = poolOverride || dbConn.getPool();
    if (pool) {
      try {
        await pool.query(`
          UPDATE scheduled_jobs
          SET 
            last_status = 'running',
            updated_at = timezone('utc', now())
          WHERE job_name = $1;
        `, [jobName]);
      } catch (err) {
        logger.debug(`Could not sync lock status for "${jobName}" to DB: ${err.message}`);
      }
    }

    logger.info(`Acquired lock on "${jobName}" by ${holder} (timeout: ${timeoutMs}ms)`);

    return {
      acquired: true,
      lockInfo,
      release: async (finalStatus = 'success', metadata = {}) => {
        return this.release(jobName, finalStatus, metadata, poolOverride);
      },
    };
  }

  /**
   * Releases the lock on jobName and updates DB status.
   */
  async release(jobName, finalStatus = 'success', metadata = {}, poolOverride = null) {
    const existing = this.locks.get(jobName);
    this.locks.delete(jobName);

    const pool = poolOverride || dbConn.getPool();
    if (pool) {
      try {
        const failureIncrementSql = finalStatus === 'failed' ? 'failure_count + 1' : '0';
        await pool.query(`
          UPDATE scheduled_jobs
          SET 
            last_status = $2,
            last_run_at = timezone('utc', now()),
            failure_count = ${failureIncrementSql},
            metadata = metadata || $3::jsonb,
            updated_at = timezone('utc', now())
          WHERE job_name = $1;
        `, [jobName, finalStatus, JSON.stringify(metadata)]);
      } catch (err) {
        logger.debug(`Could not sync release status for "${jobName}" to DB: ${err.message}`);
      }
    }

    logger.info(`Released lock on "${jobName}" (final status: ${finalStatus})`);
    return { released: true, jobName, finalStatus };
  }

  /**
   * Unconditionally forces release of all locks (used during graceful shutdown or test resets).
   */
  forceReleaseAll() {
    const releasedCount = this.locks.size;
    this.locks.clear();
    logger.info(`Force-released all ${releasedCount} active job locks.`);
    return releasedCount;
  }

  /**
   * Lists all active locks with expiration details.
   */
  listLocks() {
    const now = Date.now();
    const result = [];
    for (const [jobName, lock] of this.locks.entries()) {
      if (now <= lock.expiresAt) {
        result.push({
          jobName,
          holder: lock.holder,
          acquiredAt: new Date(lock.acquiredAt).toISOString(),
          expiresAt: new Date(lock.expiresAt).toISOString(),
          remainingSec: Math.round((lock.expiresAt - now) / 1000),
        });
      }
    }
    return result;
  }
}

if (!global.__azzurro_job_lock__) {
  global.__azzurro_job_lock__ = new JobLock();
}

module.exports = global.__azzurro_job_lock__;
