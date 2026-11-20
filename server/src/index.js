'use strict';

const app = require('./app');
const { PORT, NODE_ENV } = require('./config/env');
const logger = require('./config/logger');
const scheduler = require('./modules/automation/scheduler');

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Azzurro Insights Server running`, {
    port: PORT,
    env: NODE_ENV,
    health: `http://localhost:${PORT}/api/v1/health`,
  });

  // Initialize automated background jobs in Australia/Sydney timezone
  try {
    await scheduler.init();
    logger.info('⏰ Automated background scheduler running (Australia/Sydney)');
  } catch (err) {
    logger.warn('Could not initialize background scheduler on boot:', { error: err.message });
  }
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop background cron jobs and release locks
  try {
    scheduler.stop();
  } catch (err) {
    logger.error('Error stopping scheduler during shutdown', { error: err.message });
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-kill after 10 s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

module.exports = server;
