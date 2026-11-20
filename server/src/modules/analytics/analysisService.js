'use strict';

const http = require('http');
const { AI_SERVICE_URL, AI_SERVICE_SECRET } = require('../../config/env');
const dbConn = require('../database/connection');
const logger = require('../../config/logger');

/**
 * Service orchestrating communication with Python AI Worker,
 * batch analysis of unanalyzed reviews, persisting analysis & topic records,
 * and storing manual corrections without altering original AI output.
 */
class AnalysisService {
  /**
   * Calls Python AI worker /analyse/batch endpoint.
   */
  async callAiBatch(reviews) {
    return new Promise((resolve, reject) => {
      const url = new URL('/analyse/batch', AI_SERVICE_URL);
      const payload = JSON.stringify({
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: Number(r.rating),
          positive_text: r.positive_text,
          negative_text: r.negative_text,
          full_text: r.full_text,
          language: r.language || 'en',
        })),
      });

      const options = {
        hostname: url.hostname,
        port: url.port || 8001,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Service-Secret': AI_SERVICE_SECRET || '',
        },
        timeout: 30000,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(new Error(`Failed to parse AI worker response: ${err.message}`));
            }
          } else {
            reject(new Error(`AI worker returned HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`AI worker connection error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI worker request timed out'));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Processes a batch of unanalyzed reviews from the database.
   * If reanalyzeAll is true, processes existing reviews again and records updated analysis records.
   * 
   * @param {Object} options
   * @param {number} [options.batchSize=50]
   * @param {boolean} [options.reanalyzeAll=false]
   * @param {Object} [options.poolOverride]
   * @returns {Promise<Object>} Analysis run summary
   */
  async processBatch(options = {}) {
    const { batchSize = 50, reanalyzeAll = false, poolOverride } = options;
    const pool = poolOverride || dbConn.getPool();

    if (!pool) {
      throw new Error('Database pool not connected. Cannot process analysis batch.');
    }

    const runInTx = poolOverride
      ? (cb) => poolOverride.connect().then(cb)
      : (cb) => dbConn.transaction(cb);

    return runInTx(async (client) => {
      // 1. Fetch target reviews
      const selectSql = reanalyzeAll
        ? 'SELECT id, rating, positive_text, negative_text, full_text, language FROM reviews LIMIT $1'
        : `SELECT r.id, r.rating, r.positive_text, r.negative_text, r.full_text, r.language 
           FROM reviews r
           LEFT JOIN review_analyses a ON r.id = a.review_id
           WHERE a.id IS NULL OR a.analysis_status = 'pending'
           LIMIT $1`;

      const selectRes = await client.query(selectSql, [batchSize]);
      const reviews = selectRes.rows;

      if (!reviews || reviews.length === 0) {
        return {
          processed: 0,
          message: 'No unanalyzed reviews found in queue.',
        };
      }

      // 2. Call AI Worker
      const aiResponse = await this.callAiBatch(reviews);
      const results = aiResponse.results || [];

      let savedAnalyses = 0;
      let savedTopics = 0;

      // 3. Persist analysis & topic records inside transaction
      for (const res of results) {
        if (!res.review_id) continue;

        // If reanalysis, mark prior analyses as 'superseded' to preserve full audit history
        if (reanalyzeAll) {
          await client.query(`
            UPDATE review_analyses 
            SET analysis_status = 'superseded'
            WHERE review_id = $1 AND analysis_status = 'completed';
          `, [res.review_id]);
        }

        // Insert review_analysis
        await client.query(`
          INSERT INTO review_analyses (
            review_id, overall_sentiment, sentiment_confidence,
            detected_language, model_name, model_version,
            analysis_status, manually_verified, analyzed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          res.review_id,
          res.overall_sentiment,
          res.sentiment_confidence,
          res.detected_language,
          res.model_name,
          res.model_version,
          res.analysis_status,
          res.manually_verified || false,
        ]);
        savedAnalyses++;

        // Delete existing topics if reanalyzing, or insert cleanly
        if (reanalyzeAll) {
          await client.query('DELETE FROM review_topics WHERE review_id = $1', [res.review_id]);
        }

        // Insert topics with duplicate protection
        for (const topic of (res.topics || [])) {
          await client.query(`
            INSERT INTO review_topics (
              review_id, topic_name, topic_sentiment, confidence
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (review_id, topic_name) DO UPDATE SET
              topic_sentiment = EXCLUDED.topic_sentiment,
              confidence = EXCLUDED.confidence;
          `, [
            res.review_id,
            topic.topic_name,
            topic.topic_sentiment,
            topic.confidence,
          ]);
          savedTopics++;
        }
      }

      return {
        processed: reviews.length,
        savedAnalyses,
        savedTopics,
        modelName: results[0]?.model_name || 'unknown',
        status: 'completed',
      };
    });
  }

  /**
   * Records a manual human correction in manual_corrections without overwriting
   * original AI model prediction in review_analyses.
   * 
   * @param {Object} params
   * @param {string} params.reviewId
   * @param {string} params.targetEntity - 'review_analysis' | 'review_topic' | 'review_content'
   * @param {string} params.fieldName - e.g. 'overall_sentiment'
   * @param {string} params.oldValue
   * @param {string} params.newValue
   * @param {string} params.reason
   * @param {string} params.correctedBy
   * @param {Object} [params.poolOverride]
   */
  async recordCorrection(params) {
    const {
      reviewId,
      targetEntity,
      fieldName,
      oldValue,
      newValue,
      reason,
      correctedBy,
      poolOverride,
    } = params;

    const pool = poolOverride || dbConn.getPool();
    if (!pool) {
      throw new Error('Database pool not connected. Cannot record manual correction.');
    }

    const runInTx = poolOverride
      ? (cb) => poolOverride.connect().then(cb)
      : (cb) => dbConn.transaction(cb);

    return runInTx(async (client) => {
      // 1. Insert audit record in manual_corrections
      const res = await client.query(`
        INSERT INTO manual_corrections (
          review_id, target_entity, field_name, old_value, new_value, reason, corrected_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at;
      `, [
        reviewId,
        targetEntity,
        fieldName,
        oldValue || null,
        newValue,
        reason,
        correctedBy,
      ]);

      // 2. Mark the existing review_analysis as manually_verified = true
      if (targetEntity === 'review_analysis') {
        await client.query(`
          UPDATE review_analyses
          SET manually_verified = true
          WHERE review_id = $1 AND analysis_status = 'completed';
        `, [reviewId]);
      }

      return {
        correctionId: res.rows[0].id,
        reviewId,
        fieldName,
        newValue,
        verified: true,
      };
    });
  }
}

module.exports = new AnalysisService();
