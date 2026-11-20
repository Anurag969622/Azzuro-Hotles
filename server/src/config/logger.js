'use strict';

const winston = require('winston');
const { NODE_ENV } = require('./env');

const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    NODE_ENV === 'development'
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        )
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;

