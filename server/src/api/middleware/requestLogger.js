'use strict';

const morgan = require('morgan');
const logger = require('../../config/logger');


// Morgan token: response body size in KB
morgan.token('body-size', (req, res) => {
  const len = res.getHeader('Content-Length');
  return len ? `${(Number(len) / 1024).toFixed(1)}KB` : '-';
});

const format = ':method :url :status :response-time ms — :body-size';

const requestLogger = morgan(format, {
  stream: { write: (message) => logger.http(message.trim()) },
  skip: (req) => req.url === '/api/v1/health', // skip noisy health pings in logs
});

module.exports = requestLogger;
