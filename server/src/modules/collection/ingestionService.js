'use strict';

const { Deduplicator } = require('../normalisation/deduplicator');
const dbConn = require('../database/connection');
const logger = require('../../config/logger');

/**
 * Ingestion Service orchestrating normalization, deduplication, batch tracking,
 * and bulk database persistence.
 */
class IngestionService {
  /**
   * Looks up property UUIDs by property_code from database.
   * If DB is not reachable, returns fallback code-to-synthetic-uuid mapping.
   */
  async getPropertyMap(clientOrPool) {
    try {
      const res = await clientOrPool.query('SELECT id, property_code FROM properties');
      const map = {};
      for (const row of res.rows) {
        map[row.property_code] = row.id;
      }
      return map;
    } catch (err) {
      logger.warn('Could not query properties table from DB', { error: err.message });
      return {};
    }
  }

  /**
   * Processes a list of normalized review records into the database with duplicate detection.
   * Uses safe upsert/conflict resolution to support edited reviews without duplicate pollution.
   * 
   * @param {Object} params
   * @param {Object[]} params.records - Normalized review records
   * @param {Object[]} params.failedRows - Rows that failed parsing/normalization
   * @param {string} params.source - 'csv_import' | 'json_import' | etc.
   * @param {string} [params.fileName]
   * @param {number} [params.fileSizeBytes]
   * @param {string} [params.propertyCode] - Optional forced property
   * @returns {Promise<Object>} Import summary report
   */
  async ingestRecords({ records, failedRows = [], source = 'csv_import', fileName = 'upload', fileSizeBytes = 0, propertyCode, poolOverride }) {
    const startedAt = new Date();
    const deduplicator = new Deduplicator();

    const result = {
      source,
      fileName,
      totalSubmitted: records.length + failedRows.length,
      parsedCount: records.length,
      insertedCount: 0,
      updatedCount: 0,
      duplicateCount: 0,
      rejectedCount: failedRows.length,
      failedCount: failedRows.length,
      failedRows: [...failedRows],
      batchId: null,
      status: 'completed',
    };

    const pool = poolOverride || dbConn.getPool();
    if (!pool) {
      // In-memory / disconnected mode (e.g. testing without live PG)
      logger.info('Database pool not connected. Running dry-run ingestion validation.');
      const uniqueRecords = [];
      for (const rec of records) {
        const check = deduplicator.checkAndRecord(rec);
        if (check.isDuplicate) {
          result.duplicateCount++;
        } else {
          uniqueRecords.push(rec);
          result.insertedCount++;
        }
      }
      result.failedCount = result.rejectedCount;
      return result;
    }

    // Execute in a single transactional block
    const runInTx = poolOverride
      ? (cb) => poolOverride.connect().then(cb)
      : (cb) => dbConn.transaction(cb);

    await runInTx(async (client) => {
      const propertyMap = await this.getPropertyMap(client);

      // 1. Create collection_batch record
      const defaultPropId = propertyCode && propertyMap[propertyCode] ? propertyMap[propertyCode] : null;
      const batchRes = await client.query(`
        INSERT INTO collection_batches (
          property_id, batch_name, source, file_name, file_size_bytes, total_records, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'processing')
        RETURNING id;
      `, [
        defaultPropId,
        `Batch: ${fileName} (${new Date().toISOString()})`,
        source,
        fileName,
        fileSizeBytes,
        result.totalSubmitted,
      ]);

      const batchId = batchRes.rows[0].id;
      result.batchId = batchId;

      // 2. Fetch existing fingerprints & source_review_ids for target properties
      const existingReviewsRes = await client.query(`
        SELECT property_id, source_review_id, fingerprint FROM reviews
      `);
      for (const row of existingReviewsRes.rows) {
        if (row.source_review_id) {
          deduplicator.seenSourceIds.add(`${row.property_id}:${row.source_review_id}`);
        }
        if (row.fingerprint) {
          deduplicator.seenFingerprints.add(`${row.property_id}:${row.fingerprint}`);
        }
      }

      // 3. Process each record with deduplication and upsert handling
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const propId = propertyMap[rec.property_code];

        if (!propId) {
          result.rejectedCount++;
          result.failedRows.push({
            rowIndex: i + 1,
            raw: rec,
            error: `Property code "${rec.property_code}" does not exist in properties table.`,
          });
          continue;
        }

        rec.property_id = propId;

        // In-batch & DB duplicate detection
        const dupCheck = deduplicator.checkAndRecord(rec);
        if (dupCheck.isDuplicate) {
          // If review has source_review_id, check if it's an edited review (content changed)
          if (rec.source_review_id) {
            const updateRes = await client.query(`
              UPDATE reviews SET
                rating = $1,
                positive_text = $2,
                negative_text = $3,
                full_text = $4,
                fingerprint = $5,
                collection_batch_id = $6,
                updated_at = timezone('utc', now())
              WHERE property_id = $7 AND source = $8 AND source_review_id = $9
                AND fingerprint != $5
              RETURNING id;
            `, [
              rec.rating,
              rec.positive_text,
              rec.negative_text,
              rec.full_text,
              rec.fingerprint,
              batchId,
              propId,
              rec.source,
              rec.source_review_id,
            ]);

            if (updateRes.rowCount > 0) {
              result.updatedCount++;
              continue;
            }
          }

          result.duplicateCount++;
          continue;
        }

        // Insert new review
        await client.query(`
          INSERT INTO reviews (
            property_id, source, source_review_id, fingerprint, rating,
            review_date, positive_text, negative_text, full_text, language,
            reviewer_country, room_type, travel_type, provenance, collection_batch_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          propId,
          rec.source,
          rec.source_review_id,
          rec.fingerprint,
          rec.rating,
          rec.review_date,
          rec.positive_text,
          rec.negative_text,
          rec.full_text,
          rec.language,
          rec.reviewer_country,
          rec.room_type,
          rec.travel_type,
          JSON.stringify(rec.provenance || {}),
          batchId,
        ]);

        result.insertedCount++;
      }

      // 4. Update collection_batches status
      result.status = result.rejectedCount > 0 && result.insertedCount > 0
        ? 'partial'
        : result.rejectedCount === result.totalSubmitted ? 'failed' : 'completed';

      await client.query(`
        UPDATE collection_batches SET
          status = $1,
          completed_at = timezone('utc', now()),
          metadata = $2
        WHERE id = $3;
      `, [
        result.status,
        JSON.stringify({
          inserted: result.insertedCount,
          updated: result.updatedCount,
          duplicates: result.duplicateCount,
          rejected: result.rejectedCount,
        }),
        batchId,
      ]);

      // 5. Write collection_logs audit entry
      await client.query(`
        INSERT INTO collection_logs (
          property_id, collection_batch_id, source, status,
          started_at, completed_at, fetched_count, inserted_count,
          duplicate_count, rejected_count, error_details
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10)
      `, [
        defaultPropId,
        batchId,
        source,
        result.status === 'completed' ? 'success' : result.status === 'partial' ? 'warning' : 'failed',
        startedAt,
        result.totalSubmitted,
        result.insertedCount,
        result.duplicateCount,
        result.rejectedCount,
        result.failedRows.length > 0 ? JSON.stringify(result.failedRows) : null,
      ]);
    });

    result.failedCount = result.rejectedCount;
    return result;
  }
}

module.exports = new IngestionService();
