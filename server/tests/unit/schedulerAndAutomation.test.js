'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jobLock from '../../src/modules/automation/jobLock';
import scheduler from '../../src/modules/automation/scheduler';
import workflowEngine from '../../src/modules/automation/workflowEngine';

describe('Automation, Job Locking & Multi-Property Resilience Tests', () => {
  beforeEach(() => {
    jobLock.forceReleaseAll();
  });

  afterEach(() => {
    jobLock.forceReleaseAll();
    scheduler.stop();
  });

  describe('JobLock Mechanics', () => {
    it('successfully acquires and releases a job lock', async () => {
      const lockRes = await jobLock.acquire('test_job_1', { timeoutMs: 5000 });
      expect(lockRes.acquired).toBe(true);
      expect(jobLock.isLocked('test_job_1')).toBe(true);

      const releaseRes = await lockRes.release('success', { records: 10 });
      expect(releaseRes.released).toBe(true);
      expect(jobLock.isLocked('test_job_1')).toBe(false);
    });

    it('prevents overlapping execution when job is already locked', async () => {
      const lock1 = await jobLock.acquire('concurrent_job', { timeoutMs: 10000, holder: 'worker_1' });
      expect(lock1.acquired).toBe(true);

      // Attempt second acquisition while locked
      const lock2 = await jobLock.acquire('concurrent_job', { timeoutMs: 10000, holder: 'worker_2' });
      expect(lock2.acquired).toBe(false);
      expect(lock2.reason).toContain('currently running and locked');

      await lock1.release('success');
      expect(jobLock.isLocked('concurrent_job')).toBe(false);
    });

    it('automatically expires locks after timeout duration', async () => {
      // Create a lock with very short timeout of 50ms
      const lock = await jobLock.acquire('expiring_job', { timeoutMs: 50 });
      expect(lock.acquired).toBe(true);
      expect(jobLock.isLocked('expiring_job')).toBe(true);

      // Wait 70ms for expiration
      await new Promise((r) => setTimeout(r, 70));
      expect(jobLock.isLocked('expiring_job')).toBe(false);
    });

    it('forceReleaseAll clears all active locks cleanly', async () => {
      await jobLock.acquire('lock_a');
      await jobLock.acquire('lock_b');
      expect(jobLock.listLocks().length).toBe(2);

      const released = jobLock.forceReleaseAll();
      expect(released).toBe(2);
      expect(jobLock.listLocks().length).toBe(0);
    });
  });

  describe('Scheduler & Timezone Configuration', () => {
    it('initializes scheduled jobs in Australia/Sydney timezone', async () => {
      await scheduler.init();
      const status = await scheduler.getStatus();

      expect(status.timezone).toBe('Australia/Sydney');
      expect(status.schedulerActive).toBe(true);
      expect(status.totalRegisteredJobs).toBeGreaterThanOrEqual(4);

      const dailyJob = status.jobs.find((j) => j.jobName === 'daily_collection_all');
      expect(dailyJob).toBeDefined();
      expect(dailyJob.cronExpression).toBe('0 2 * * *');
      expect(dailyJob.isActive).toBe(true);
    });

    it('allows pausing and resuming registered jobs', async () => {
      await scheduler.init();

      const pauseRes = scheduler.toggleJob('daily_collection_all', false);
      expect(pauseRes.isActive).toBe(false);

      const resumeRes = scheduler.toggleJob('daily_collection_all', true);
      expect(resumeRes.isActive).toBe(true);
    });
  });

  describe('WorkflowEngine Retry & Multi-Property Isolation', () => {
    it('retries transient failures with exponential backoff and succeeds', async () => {
      let attempts = 0;
      const result = await workflowEngine.executeWithRetry(async (attempt) => {
        attempts++;
        if (attempt < 2) {
          throw new Error('Transient network timeout');
        }
        return 'success_on_retry';
      }, {
        maxRetries: 3,
        baseDelayMs: 20, // Short delay for testing
        context: 'Test transient network retry',
      });

      expect(result).toBe('success_on_retry');
      expect(attempts).toBe(3);
    });

    it('fails after exceeding max retries with clear error', async () => {
      await expect(
        workflowEngine.executeWithRetry(async () => {
          throw new Error('Persistent external failure');
        }, {
          maxRetries: 2,
          baseDelayMs: 10,
          context: 'Test persistent failure',
        })
      ).rejects.toThrow('Persistent external failure');
    });

    it('ensures failure of one property does NOT halt execution for other properties', async () => {
      const properties = ['OLYMPIC-PADDINGTON', 'POTTS-POINT', 'CENTRAL-SYDNEY', 'DARLING-HARBOUR'];

      // Simulate failure specifically for POTTS-POINT
      const summary = await workflowEngine.runMultiPropertyWorkflow({
        jobName: 'test_isolation_workflow',
        properties,
        sampleCount: 5,
        simulateFailureForProperty: 'POTTS-POINT',
        maxRetries: 1,
      });

      expect(summary.totalProperties).toBe(4);
      expect(summary.failedProperties).toBe(1);
      expect(summary.successfulProperties).toBe(3);
      expect(summary.status).toBe('partial');

      // Potts Point failed
      expect(summary.propertyOutcomes['POTTS-POINT'].status).toBe('failed');
      expect(summary.propertyOutcomes['POTTS-POINT'].error).toBeDefined();

      // The other three properties succeeded!
      expect(summary.propertyOutcomes['OLYMPIC-PADDINGTON'].status).toBe('success');
      expect(summary.propertyOutcomes['CENTRAL-SYDNEY'].status).toBe('success');
      expect(summary.propertyOutcomes['DARLING-HARBOUR'].status).toBe('success');
    });
  });
});
