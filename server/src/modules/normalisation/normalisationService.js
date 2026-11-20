'use strict';

const { generateFingerprint, normalizeText } = require('./deduplicator');

// Canonical property code mapping
const PROPERTY_ALIAS_MAP = {
  'olympic hotel paddington': 'OLYMPIC-PADDINGTON',
  'azzurro olympic hotel paddington': 'OLYMPIC-PADDINGTON',
  'olympic-paddington': 'OLYMPIC-PADDINGTON',
  'olympic paddington': 'OLYMPIC-PADDINGTON',
  'paddington': 'OLYMPIC-PADDINGTON',

  'potts point': 'POTTS-POINT',
  'azzurro pod hotel potts point': 'POTTS-POINT',
  'azzurro potts point': 'POTTS-POINT',
  'venus potts point sydney': 'POTTS-POINT',
  'venus potts point': 'POTTS-POINT',
  'potts-point': 'POTTS-POINT',

  'central sydney': 'CENTRAL-SYDNEY',
  'azzurro pod hotel central sydney - near central station': 'CENTRAL-SYDNEY',
  'azzurro pod hotel central sydney': 'CENTRAL-SYDNEY',
  'azzurro central sydney': 'CENTRAL-SYDNEY',
  'venus surry hills': 'CENTRAL-SYDNEY',
  'venus central sydney': 'CENTRAL-SYDNEY',
  'surry hills': 'CENTRAL-SYDNEY',
  'central-sydney': 'CENTRAL-SYDNEY',

  'darling harbour': 'DARLING-HARBOUR',
  'azzurro darling harbour': 'DARLING-HARBOUR',
  'chateau de venus': 'DARLING-HARBOUR',
  'château de venus': 'DARLING-HARBOUR',
  'chateau de venus darling harbour': 'DARLING-HARBOUR',
  'darling-harbour': 'DARLING-HARBOUR',
};

// Flexible column aliases for CSV / JSON header detection
const COLUMN_ALIASES = {
  property: ['property', 'hotel', 'property_name', 'hotel_name', 'property_code', 'propertycode', 'resort'],
  rating: ['rating', 'score', 'overall_score', 'review_score', 'guest_rating', 'stars'],
  review_date: ['review_date', 'date', 'reviewdate', 'stay_date', 'submission_date', 'submitted_at', 'created_at'],
  positive_text: ['positive_text', 'positive', 'positives', 'liked', 'pros', 'positive_review', 'what_guest_liked'],
  negative_text: ['negative_text', 'negative', 'negatives', 'disliked', 'cons', 'negative_review', 'what_guest_disliked'],
  full_text: ['full_text', 'review_text', 'comment', 'comments', 'review', 'content', 'body'],
  reviewer_country: ['reviewer_country', 'country', 'guest_country', 'origin', 'nationality'],
  language: ['language', 'lang'],
  room_type: ['room_type', 'room', 'room_name', 'accommodation_type'],
  travel_type: ['travel_type', 'traveller_type', 'trip_type', 'travel_purpose'],
  source_review_id: ['review_id', 'source_review_id', 'id', 'booking_review_id', 'external_id'],
};

/**
 * Detects mapping between input headers and canonical fields.
 * @param {string[]} headers
 * @returns {Record<string, string>} Map of inputHeader -> canonicalField
 */
function detectColumnMapping(headers) {
  const mapping = {};
  for (const h of headers) {
    const cleanHeader = h.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(cleanHeader)) {
        mapping[h] = canonical;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Normalizes property name / code to canonical code.
 */
function resolvePropertyCode(input) {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  return PROPERTY_ALIAS_MAP[clean] || input.toUpperCase();
}

/**
 * Normalizes rating to 0 - 10 scale numeric with 2 decimals.
 * Handles 5-star ratings (scales to 10 if max observed <= 5).
 */
function normalizeRating(rawRating) {
  if (rawRating === undefined || rawRating === null || rawRating === '') {
    throw new Error('Rating is required');
  }
  const parsed = parseFloat(rawRating);
  if (isNaN(parsed)) {
    throw new Error(`Invalid rating numeric format: "${rawRating}"`);
  }
  if (parsed < 0 || parsed > 10) {
    throw new Error(`Rating out of range (must be 0–10): ${parsed}`);
  }
  return Math.round(parsed * 100) / 100;
}

/**
 * Parses and normalizes various date formats into YYYY-MM-DD.
 */
function normalizeDate(rawDate) {
  if (!rawDate) {
    throw new Error('Review date is required');
  }

  // If already YYYY-MM-DD
  if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
    return rawDate.trim();
  }

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: "${rawDate}"`);
  }

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes a raw input record into canonical review object.
 */
function normalizeRecord(rawRecord, options = {}) {
  const { defaultPropertyCode, source = 'csv_import' } = options;

  const propertyCode = resolvePropertyCode(rawRecord.property || defaultPropertyCode);
  if (!propertyCode) {
    throw new Error('Property could not be resolved from record or default selection');
  }

  const rating = normalizeRating(rawRecord.rating);
  const reviewDate = normalizeDate(rawRecord.review_date);

  const posText = normalizeText(rawRecord.positive_text);
  const negText = normalizeText(rawRecord.negative_text);
  let fullText = normalizeText(rawRecord.full_text);

  if (!fullText) {
    fullText = [posText ? `Positive: ${posText}` : '', negText ? `Negative: ${negText}` : '']
      .filter(Boolean)
      .join(' | ');
  }

  if (!fullText || !fullText.trim()) {
    throw new Error('Review content is required (must provide positive_text, negative_text, or full_text)');
  }

  const sourceReviewId = rawRecord.source_review_id ? String(rawRecord.source_review_id).trim() : null;

  const norm = {
    property_code: propertyCode,
    source,
    source_review_id: sourceReviewId,
    rating,
    review_date: reviewDate,
    positive_text: posText || null,
    negative_text: negText || null,
    full_text: fullText || null,
    language: rawRecord.language ? rawRecord.language.trim().toLowerCase() : 'en',
    reviewer_country: rawRecord.reviewer_country ? rawRecord.reviewer_country.trim() : null,
    room_type: rawRecord.room_type ? rawRecord.room_type.trim() : null,
    travel_type: rawRecord.travel_type ? rawRecord.travel_type.trim() : null,
    provenance: {
      imported_at: new Date().toISOString(),
      raw_source: source,
      synthetic: rawRecord.synthetic === true || Boolean(rawRecord.provenance?.synthetic),
    },
  };

  norm.fingerprint = generateFingerprint(norm);
  return norm;
}

module.exports = {
  COLUMN_ALIASES,
  PROPERTY_ALIAS_MAP,
  detectColumnMapping,
  resolvePropertyCode,
  normalizeRating,
  normalizeDate,
  normalizeRecord,
};

