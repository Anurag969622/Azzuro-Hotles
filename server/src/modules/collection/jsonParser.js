'use strict';

const { normalizeRecord } = require('../normalisation/normalisationService');

/**
 * Parses JSON buffer or payload (single object or array) into normalized review records.
 * 
 * @param {Buffer|string|Object|Array} input - JSON payload
 * @param {Object} options
 * @param {string} [options.defaultPropertyCode]
 * @returns {{ validRecords: Object[], failedRows: Object[] }}
 */
function parseJson(input, options = {}) {
  let data = input;
  if (Buffer.isBuffer(input) || typeof input === 'string') {
    const raw = Buffer.isBuffer(input) ? input.toString('utf8') : input;
    if (!raw || !raw.trim()) {
      throw new Error('JSON input is empty');
    }
    data = JSON.parse(raw);
  }

  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) {
    throw new Error('JSON contains no review records');
  }

  const validRecords = [];
  const failedRows = [];

  items.forEach((item, idx) => {
    const rowIndex = idx + 1;
    try {
      const normalized = normalizeRecord(item, {
        defaultPropertyCode: options.defaultPropertyCode,
        source: 'json_import',
      });
      validRecords.push(normalized);
    } catch (err) {
      failedRows.push({
        rowIndex,
        raw: item,
        error: err.message,
      });
    }
  });

  return {
    validRecords,
    failedRows,
  };
}

module.exports = { parseJson };

