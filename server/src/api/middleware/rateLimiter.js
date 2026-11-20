'use strict';

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter: 200 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
  },
});

/**
 * Stricter limiter for file import endpoints: 10 requests per minute per IP.
 */
const importLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many import requests. Please slow down.', code: 'RATE_LIMITED' },
  },
});

module.exports = { apiLimiter, importLimiter };
