'use strict';

const Joi = require('joi');
require('dotenv').config();

const envSchema = Joi.object({
  NODE_ENV:                Joi.string().valid('development', 'test', 'production').default('development'),
  PORT:                    Joi.number().integer().min(1024).max(65535).default(3001),
  CORS_ORIGIN:             Joi.string().default('http://localhost:5173'),

  // Supabase — optional during early Phase 2 (DB not wired yet)
  SUPABASE_URL:            Joi.string().uri().optional().allow(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().optional().allow(''),
  SUPABASE_ANON_KEY:       Joi.string().optional().allow(''),
  DATABASE_URL:            Joi.string().optional().allow(''),

  // AI worker
  AI_SERVICE_URL:          Joi.string().uri().default('http://localhost:8001'),
  AI_SERVICE_SECRET:       Joi.string().optional().allow(''),

  // Ingestion
  MAX_IMPORT_FILE_SIZE_MB: Joi.number().integer().min(1).max(100).default(10),
  AI_BATCH_SIZE:           Joi.number().integer().min(1).max(200).default(50),

  // Automation — must stay false until authorised
  PLAYWRIGHT_ENABLED:      Joi.boolean().default(false),
  PLAYWRIGHT_AUTH_TOKEN:   Joi.string().optional().allow(''),
}).unknown(true); // allow OS env vars

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error(`[config/env] Environment validation failed:\n  ${error.message}`);
  process.exit(1);
}

module.exports = {
  NODE_ENV:               env.NODE_ENV,
  PORT:                   env.PORT,
  CORS_ORIGIN:            env.CORS_ORIGIN,
  SUPABASE_URL:           env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY:      env.SUPABASE_ANON_KEY,
  DATABASE_URL:           env.DATABASE_URL,
  AI_SERVICE_URL:         env.AI_SERVICE_URL,
  AI_SERVICE_SECRET:      env.AI_SERVICE_SECRET,
  MAX_IMPORT_FILE_SIZE_MB: env.MAX_IMPORT_FILE_SIZE_MB,
  AI_BATCH_SIZE:          env.AI_BATCH_SIZE,
  PLAYWRIGHT_ENABLED:     env.PLAYWRIGHT_ENABLED,
  IS_DEV:                 env.NODE_ENV === 'development',
  IS_TEST:                env.NODE_ENV === 'test',
  IS_PROD:                env.NODE_ENV === 'production',
};

