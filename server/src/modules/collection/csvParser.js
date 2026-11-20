'use strict';

const { parse } = require('csv-parse/sync');
const { detectColumnMapping, normalizeRecord } = require('../normalisation/normalisationService');

/**
 * Parses raw CSV buffer or string into normalized review records.
 * Supports flexible column aliases, property selection, rating validation.
 * 
 * @param {Buffer|string} input - Raw CSV content
 * @param {Object} options
 * @param {Record<string, string>} [options.mapping] - Optional explicit header mapping
 * @param {string} [options.defaultPropertyCode] - Property code fallback
 * @returns {Promise<{ validRecords: Object[], failedRows: Object[], headers: string[], detectedMapping: Object }>}
 */
async function parseCsv(input, options = {}) {
  const content = Buffer.isBuffer(input) ? input.toString('utf8') : input;
  
  if (!content || !content.trim()) {
    throw new Error('CSV input is empty');
  }

  const rawRows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  const headers = Object.keys(rawRows[0]);
  const detectedMapping = options.mapping || detectColumnMapping(headers);

  const validRecords = [];
  const failedRows = [];

  rawRows.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1-based, +1 for header
    try {
      // Map row to canonical keys
      const mappedRecord = {};
      for (const [colName, val] of Object.entries(row)) {
        const canonicalKey = detectedMapping[colName];
        if (canonicalKey) {
          mappedRecord[canonicalKey] = val;
        } else {
          // retain unmapped for fallback check
          mappedRecord[colName] = val;
        }
      }

      const normalized = normalizeRecord(mappedRecord, {
        defaultPropertyCode: options.defaultPropertyCode,
        source: 'csv_import',
      });

      validRecords.push(normalized);
    } catch (err) {
      failedRows.push({
        rowIndex,
        raw: row,
        error: err.message,
      });
    }
  });

  return {
    validRecords,
    failedRows,
    headers,
    detectedMapping,
  };
}

module.exports = { parseCsv };

