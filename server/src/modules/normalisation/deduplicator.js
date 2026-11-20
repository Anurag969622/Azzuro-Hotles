'use strict';

const crypto = require('crypto');

/**
 * Normalizes text by trimming whitespace, lowercasing, and replacing multiple whitespace characters.
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Generates a deterministic SHA-256 fingerprint for a review to prevent duplicates
 * when source_review_id is absent. Uses normalized content and stable metadata.
 * Does NOT rely on review_date alone.
 * 
 * @param {Object} review
 * @param {string} review.property_code
 * @param {string} review.reviewer_name
 * @param {string} review.reviewer_country
 * @param {string} review.room_type
 * @param {string|number} review.rating
 * @param {string} review.positive_text
 * @param {string} review.negative_text
 * @param {string} review.full_text
 * @param {string} review.review_date
 * @returns {string} 64-char hex SHA-256 fingerprint
 */
function generateFingerprint(review) {
  const normProp = normalizeText(review.property_code || review.property_id || '').toLowerCase();
  const normRating = Number(review.rating || 0).toFixed(1);
  const normDate = review.review_date || '';
  const normCountry = normalizeText(review.reviewer_country || '').toLowerCase();
  const normPos = normalizeText(review.positive_text || '').toLowerCase();
  const normNeg = normalizeText(review.negative_text || '').toLowerCase();
  const normFull = normalizeText(review.full_text || '').toLowerCase();

  // Combine stable metadata + textual payload
  const payload = [
    normProp,
    normDate,
    normRating,
    normCountry,
    normPos,
    normNeg,
    normFull
  ].join('|#|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Validates whether a duplicate exists in an in-memory batch or DB existing map.
 */
class Deduplicator {
  constructor() {
    this.seenSourceIds = new Set();
    this.seenFingerprints = new Set();
  }

  /**
   * Checks if a review record is already known.
   * If not seen, records it in the deduplicator.
   * @param {Object} review
   * @returns {{ isDuplicate: boolean, reason?: string }}
   */
  checkAndRecord(review) {
    if (review.source_review_id) {
      const key = `${review.property_id || review.property_code}:${review.source_review_id}`;
      if (this.seenSourceIds.has(key)) {
        return { isDuplicate: true, reason: `Duplicate source_review_id: ${review.source_review_id}` };
      }
      this.seenSourceIds.add(key);
    }

    if (review.fingerprint) {
      const fpKey = `${review.property_id || review.property_code}:${review.fingerprint}`;
      if (this.seenFingerprints.has(fpKey)) {
        return { isDuplicate: true, reason: 'Duplicate content fingerprint' };
      }
      this.seenFingerprints.add(fpKey);
    }

    return { isDuplicate: false };
  }

  reset() {
    this.seenSourceIds.clear();
    this.seenFingerprints.clear();
  }
}

module.exports = {
  normalizeText,
  generateFingerprint,
  Deduplicator,
};

