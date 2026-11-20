'use strict';

const { NODE_ENV } = require('../../config/env');
const logger = require('../../config/logger');

/**
 * Centralised error handler — MUST be registered as the last middleware in app.js.
 * Never exposes internal stack traces or SQL errors to clients in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err.isOperational === true;

  // Log internally — always
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Client response — never leak internals in production
  const responseBody = {
    success: false,
    error: {
      message: isOperational || NODE_ENV !== 'production'
        ? err.message
        : 'An unexpected error occurred. Please try again.',
      code: err.code || 'INTERNAL_ERROR',
      ...(NODE_ENV !== 'production' && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(responseBody);
}

/**
 * 404 handler — register AFTER all routes, BEFORE errorHandler.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    },
  });
}

/**
 * Factory for operational errors (expected errors, shown to client).
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, notFoundHandler, AppError };
