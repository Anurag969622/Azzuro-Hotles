'use strict';

const { Router } = require('express');
const dbConn = require('../../modules/database/connection');
const { AppError } = require('../middleware/errorHandler');
const supabaseAnalytics = require('../../modules/database/supabaseAnalytics');

const router = Router();

/**
 * GET /api/properties
 * Lists all hotel properties with review counts and average rating.
 * Uses supabaseAnalytics to avoid complex SQL that fails over PostgREST.
 */
router.get('/', async (req, res, next) => {
  try {
    const pool = dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      const { rows } = await pool.query(`
        SELECT 
          p.id, p.property_code, p.name, p.booking_url, p.location, p.country, p.timezone, p.is_active, p.created_at, p.updated_at,
          COUNT(r.id)::int as total_reviews,
          COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating
        FROM properties p
        LEFT JOIN reviews r ON p.id = r.property_id
        WHERE p.is_active = true
        GROUP BY p.id, p.property_code, p.name, p.booking_url, p.location, p.country, p.timezone, p.is_active, p.created_at, p.updated_at
        ORDER BY p.property_code ASC;
      `);
      return res.json({ success: true, count: rows.length, properties: rows });
    }

    const properties = await supabaseAnalytics.propertiesWithStats();
    res.json({ success: true, count: properties.length, properties });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/properties/:id
 * Returns single property details, recent reviews, and rating stats.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = dbConn.getPool();
    if (!pool) {
      throw new AppError('Database connection pool not available', 503);
    }

    // Lookup by UUID or property_code
    const propRes = await pool.query(`
      SELECT 
        p.id, p.property_code, p.name, p.booking_url, p.location, p.country, p.timezone, p.is_active, p.created_at, p.updated_at,
        COUNT(r.id)::int as total_reviews,
        COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float as avg_rating
      FROM properties p
      LEFT JOIN reviews r ON p.id = r.property_id
      WHERE p.id::text = $1 OR p.property_code = $1
      GROUP BY p.id, p.property_code, p.name, p.booking_url, p.location, p.country, p.timezone, p.is_active, p.created_at, p.updated_at;
    `, [id]);

    if (propRes.rows.length === 0) {
      throw new AppError(`Property not found: "${id}"`, 404, 'PROPERTY_NOT_FOUND');
    }

    const property = propRes.rows[0];

    // Recent reviews preview
    const recentRes = await pool.query(`
      SELECT r.*, a.overall_sentiment, a.sentiment_confidence
      FROM reviews r
      LEFT JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment, sentiment_confidence
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      WHERE r.property_id = $1
      ORDER BY r.review_date DESC
      LIMIT 10;
    `, [property.id]);

    res.json({
      success: true,
      property: {
        ...property,
        recentReviews: recentRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

