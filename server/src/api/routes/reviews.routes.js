'use strict';

const { Router } = require('express');
const multer = require('multer');
const dbConn = require('../../modules/database/connection');
const { parseCsv } = require('../../modules/collection/csvParser');
const { parseJson } = require('../../modules/collection/jsonParser');
const ingestionService = require('../../modules/collection/ingestionService');
const analysisService = require('../../modules/analytics/analysisService');
const { importLimiter } = require('../middleware/rateLimiter');
const { AppError } = require('../middleware/errorHandler');
const supabaseAnalytics = require('../../modules/database/supabaseAnalytics');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * GET /api/reviews
 * Paginated, filtered, sorted reviews — routed through supabaseAnalytics (PostgREST).
 * Query Params:
 * - property_id | propertyCode | property: UUID or property_code
 * - sentiment: positive | negative | neutral | mixed
 * - min_rating / max_rating / rating: float / range string
 * - start_date / end_date: YYYY-MM-DD
 * - topic: string
 * - search: string
 * - sort_by: review_date | rating | created_at   (default: review_date)
 * - sort_order: asc | desc                        (default: desc)
 * - page: integer (default 1)
 * - limit: integer (default 15, max 100)
 */
router.get('/', async (req, res, next) => {
  try {
    const pool = dbConn.getPool();
    if (pool && !pool.isSupabaseAdapter) {
      return getReviewsViaPool(req, res, next, pool);
    }

    const {
      property_id,
      propertyCode,
      property,
      sentiment,
      min_rating,
      max_rating,
      rating,
      start_date,
      end_date,
      topic,
      search,
      sort_by = 'review_date',
      sort_order = 'desc',
      page = 1,
      limit = 15,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const propParam = property_id || propertyCode || property;

    // Handle rating range shorthand
    let minRatingVal = min_rating;
    let maxRatingVal = max_rating;
    if (rating && !min_rating && !max_rating) {
      if (rating.includes('-')) {
        const [mn, mx] = rating.split('-').map(Number);
        if (!isNaN(mn)) minRatingVal = mn;
        if (!isNaN(mx)) maxRatingVal = mx;
      } else if (rating.startsWith('<')) {
        maxRatingVal = Number(rating.slice(1));
      }
    }

    const { reviews, total } = await supabaseAnalytics.reviewsList({
      propertyCode: propParam && propParam !== 'ALL' ? propParam : null,
      sentiment: sentiment && sentiment !== 'ALL' ? sentiment : null,
      minRating: minRatingVal,
      maxRating: maxRatingVal,
      startDate: start_date,
      endDate: end_date,
      search,
      topic: topic && topic !== 'ALL' ? topic : null,
      page: pageNum,
      limit: limitNum,
      sortBy: sort_by,
      sortOrder: sort_order,
    });

    res.json({
      success: true,
      total,
      count: reviews.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      reviews,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reviews/:id
 * Single review with full analysis and topic breakdown.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = dbConn.getPool();
    if (!pool) throw new AppError('Database pool not connected', 503);

    const revRes = await pool.query(`
      SELECT r.*, p.name as property_name, p.property_code
      FROM reviews r
      JOIN properties p ON r.property_id = p.id
      WHERE r.id::text = $1;
    `, [id]);

    if (revRes.rows.length === 0) {
      throw new AppError(`Review not found: "${id}"`, 404, 'REVIEW_NOT_FOUND');
    }

    const review = revRes.rows[0];

    // Fetch analysis history
    const analysisRes = await pool.query(`
      SELECT * FROM review_analyses WHERE review_id = $1 ORDER BY analyzed_at DESC;
    `, [review.id]);

    // Fetch topics
    const topicsRes = await pool.query(`
      SELECT * FROM review_topics WHERE review_id = $1 ORDER BY topic_name ASC;
    `, [review.id]);

    // Fetch manual corrections if any
    const correctionsRes = await pool.query(`
      SELECT * FROM manual_corrections WHERE review_id = $1 ORDER BY created_at DESC;
    `, [review.id]);

    const latestAnalysis = analysisRes.rows[0] || null;

    res.json({
      success: true,
      review: {
        ...review,
        overall_sentiment: latestAnalysis?.overall_sentiment || null,
        sentiment_confidence: latestAnalysis?.sentiment_confidence || null,
        detected_language: latestAnalysis?.detected_language || review.language || 'en',
        latestAnalysis,
        analysisHistory: analysisRes.rows,
        topics: topicsRes.rows,
        manualCorrections: correctionsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews/import/csv
 */
router.post('/import/csv', importLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No CSV file uploaded', 400);

    const { defaultPropertyCode } = req.body;
    const { validRecords, failedRows } = await parseCsv(req.file.buffer, { defaultPropertyCode });

    const summary = await ingestionService.ingestRecords({
      records: validRecords,
      failedRows,
      source: 'csv_import',
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      propertyCode: defaultPropertyCode,
    });

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews/import/json
 */
router.post('/import/json', importLimiter, upload.single('file'), async (req, res, next) => {
  try {
    let payload;
    let fileName = 'payload.json';
    let fileSizeBytes = 0;

    if (req.file) {
      payload = req.file.buffer;
      fileName = req.file.originalname;
      fileSizeBytes = req.file.size;
    } else if (req.body && (req.body.reviews || Array.isArray(req.body))) {
      payload = req.body.reviews || req.body;
      fileSizeBytes = JSON.stringify(payload).length;
    } else {
      throw new AppError('Provide a JSON file or a reviews array in request body', 400);
    }

    const { defaultPropertyCode } = req.body;
    const { validRecords, failedRows } = parseJson(payload, { defaultPropertyCode });

    const summary = await ingestionService.ingestRecords({
      records: validRecords,
      failedRows,
      source: 'json_import',
      fileName,
      fileSizeBytes,
      propertyCode: defaultPropertyCode,
    });

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews/:id/reanalyze
 * Reanalyzes a single review through the AI engine and updates analysis records.
 */
router.post('/:id/reanalyze', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = dbConn.getPool();
    if (!pool) throw new AppError('Database pool not connected', 503);

    const revRes = await pool.query('SELECT * FROM reviews WHERE id::text = $1', [id]);
    if (revRes.rows.length === 0) throw new AppError('Review not found', 404);

    const review = revRes.rows[0];
    const aiResp = await analysisService.callAiBatch([review]);
    const analysisResult = aiResp.results?.[0];

    if (!analysisResult) throw new AppError('AI reanalysis produced no output', 500);

    // Persist new analysis
    await dbConn.transaction(async (client) => {
      // Mark old completed as superseded
      await client.query(`
        UPDATE review_analyses SET analysis_status = 'superseded' WHERE review_id = $1 AND analysis_status = 'completed';
      `, [review.id]);

      await client.query(`
        INSERT INTO review_analyses (
          review_id, overall_sentiment, sentiment_confidence, detected_language,
          model_name, model_version, analysis_status, manually_verified, analyzed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', false, NOW());
      `, [
        review.id,
        analysisResult.overall_sentiment,
        analysisResult.sentiment_confidence,
        analysisResult.detected_language,
        analysisResult.model_name,
        analysisResult.model_version,
      ]);

      await client.query('DELETE FROM review_topics WHERE review_id = $1', [review.id]);

      for (const t of (analysisResult.topics || [])) {
        await client.query(`
          INSERT INTO review_topics (review_id, topic_name, topic_sentiment, confidence)
          VALUES ($1, $2, $3, $4);
        `, [review.id, t.topic_name, t.topic_sentiment, t.confidence]);
      }
    });

    res.json({
      success: true,
      message: 'Review reanalyzed successfully',
      result: analysisResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/reviews/:id/correction
 * Records a human correction without overwriting original AI model outputs.
 */
router.patch('/:id/correction', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetEntity = 'review_analysis', fieldName = 'overall_sentiment', oldValue, newValue, reason, correctedBy } = req.body;

    if (!newValue || !reason || !correctedBy) {
      throw new AppError('Missing required fields: newValue, reason, correctedBy', 400);
    }

    const result = await analysisService.recordCorrection({
      reviewId: id,
      targetEntity,
      fieldName,
      oldValue,
      newValue,
      reason,
      correctedBy,
    });

    res.json({
      success: true,
      message: 'Manual correction recorded successfully',
      correction: result,
    });
  } catch (err) {
    next(err);
  }
});

async function getReviewsViaPool(req, res, next, pool) {
  try {
    const {
      property_id,
      propertyCode,
      property,
      sentiment,
      min_rating,
      max_rating,
      rating,
      start_date,
      end_date,
      topic,
      search,
      sort_by = 'review_date',
      sort_order = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['1=1'];
    const params = [];
    let pIdx = 1;

    const propParam = property_id || propertyCode || property;
    if (propParam) {
      conditions.push(`(r.property_id::text = $${pIdx} OR p.property_code = $${pIdx})`);
      params.push(propParam);
      pIdx++;
    }

    if (sentiment) {
      conditions.push(`LOWER(a.overall_sentiment) = $${pIdx}`);
      params.push(sentiment.toLowerCase());
      pIdx++;
    }

    if (min_rating) {
      conditions.push(`r.rating >= $${pIdx}`);
      params.push(parseFloat(min_rating));
      pIdx++;
    }

    if (max_rating) {
      conditions.push(`r.rating <= $${pIdx}`);
      params.push(parseFloat(max_rating));
      pIdx++;
    }

    if (rating) {
      if (rating.includes('-')) {
        const [min, max] = rating.split('-').map(Number);
        if (!isNaN(min)) {
          conditions.push(`r.rating >= $${pIdx}`);
          params.push(min);
          pIdx++;
        }
        if (!isNaN(max)) {
          conditions.push(`r.rating <= $${pIdx}`);
          params.push(max);
          pIdx++;
        }
      } else if (rating.startsWith('<')) {
        const max = Number(rating.slice(1));
        if (!isNaN(max)) {
          conditions.push(`r.rating < $${pIdx}`);
          params.push(max);
          pIdx++;
        }
      }
    }

    if (start_date) {
      conditions.push(`r.review_date >= $${pIdx}`);
      params.push(start_date);
      pIdx++;
    }

    if (end_date) {
      conditions.push(`r.review_date <= $${pIdx}`);
      params.push(end_date);
      pIdx++;
    }

    if (search) {
      conditions.push(`r.full_text ILIKE $${pIdx}`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (topic) {
      conditions.push(`EXISTS (SELECT 1 FROM review_topics rt WHERE rt.review_id = r.id AND rt.topic_name ILIKE $${pIdx})`);
      params.push(topic);
      pIdx++;
    }

    const allowedSort = ['review_date', 'rating', 'created_at'];
    const safeSort = allowedSort.includes(sort_by) ? `r.${sort_by}` : 'r.review_date';
    const safeOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const hasPropertyFilter = Boolean(propParam);
    const hasSentimentFilter = Boolean(sentiment);
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM reviews r
      ${hasPropertyFilter ? 'JOIN properties p ON r.property_id = p.id' : ''}
      ${hasSentimentFilter ? `LEFT JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id` : ''}
      WHERE ${conditions.join(' AND ')};
    `;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT 
        r.id, r.property_id, r.source, r.source_review_id, r.fingerprint, r.rating, r.review_date,
        r.positive_text, r.negative_text, r.full_text, r.language, r.reviewer_country, r.room_type,
        r.travel_type, r.provenance, r.collection_batch_id, r.collected_at, r.created_at, r.updated_at,
        p.name as property_name,
        p.property_code,
        a.overall_sentiment,
        a.sentiment_confidence,
        a.detected_language,
        a.manually_verified,
        COALESCE(
          json_agg(
            json_build_object(
              'topic_name', rt.topic_name,
              'topic_sentiment', rt.topic_sentiment,
              'confidence', rt.confidence
            )
          ) FILTER (WHERE rt.id IS NOT NULL), '[]'::json
        ) as topics
      FROM reviews r
      JOIN properties p ON r.property_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (review_id) review_id, overall_sentiment, sentiment_confidence, detected_language, manually_verified
        FROM review_analyses
        WHERE analysis_status = 'completed'
        ORDER BY review_id, analyzed_at DESC
      ) a ON r.id = a.review_id
      LEFT JOIN review_topics rt ON r.id = rt.review_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY r.id, r.property_id, r.source, r.source_review_id, r.fingerprint, r.rating, r.review_date,
        r.positive_text, r.negative_text, r.full_text, r.language, r.reviewer_country, r.room_type,
        r.travel_type, r.provenance, r.collection_batch_id, r.collected_at, r.created_at, r.updated_at,
        p.name, p.property_code, a.overall_sentiment, a.sentiment_confidence, a.detected_language, a.manually_verified
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;

    params.push(limitNum, offset);
    const dataRes = await pool.query(dataSql, params);

    return res.json({
      success: true,
      total,
      count: dataRes.rows.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      reviews: dataRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = router;
