import { describe, it, expect, beforeEach } from 'vitest';
import { parseCsv } from '../../src/modules/collection/csvParser';
import { parseJson } from '../../src/modules/collection/jsonParser';
import { generateFingerprint, Deduplicator } from '../../src/modules/normalisation/deduplicator';
import { generateSyntheticReviews } from '../../src/modules/collection/syntheticDataGenerator';
import { CollectionAdapterManager } from '../../src/modules/collection/collectionAdapter';

describe('Normalisation & Deduplication Unit Tests', () => {
  it('generates consistent SHA-256 fingerprint for identical content', () => {
    const rev1 = {
      property_code: 'OLYMPIC-PADDINGTON',
      rating: 8.5,
      review_date: '2026-03-15',
      reviewer_country: 'Australia',
      positive_text: 'Great location and friendly staff',
      negative_text: 'Small bathroom',
      full_text: 'Positive: Great location | Negative: Small bathroom',
    };

    const rev2 = {
      property_code: 'OLYMPIC-PADDINGTON',
      rating: 8.5,
      review_date: '2026-03-15',
      reviewer_country: 'Australia',
      positive_text: '  Great location and friendly staff  ',
      negative_text: 'Small bathroom',
      full_text: 'Positive: Great location | Negative: Small bathroom',
    };

    const fp1 = generateFingerprint(rev1);
    const fp2 = generateFingerprint(rev2);
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(64);
  });

  it('detects in-memory duplicate records using Deduplicator', () => {
    const dedup = new Deduplicator();

    const recordA = {
      property_code: 'POTTS-POINT',
      source_review_id: 'REV-1001',
      fingerprint: 'fp-1111',
    };

    const check1 = dedup.checkAndRecord(recordA);
    expect(check1.isDuplicate).toBe(false);

    // Identical source_review_id must be flagged duplicate
    const check2 = dedup.checkAndRecord(recordA);
    expect(check2.isDuplicate).toBe(true);

    // Identical fingerprint without source_review_id must also be flagged duplicate
    const recordB = {
      property_code: 'POTTS-POINT',
      fingerprint: 'fp-1111',
    };
    const check3 = dedup.checkAndRecord(recordB);
    expect(check3.isDuplicate).toBe(true);
  });
});

describe('CSV Parser Unit Tests', () => {
  it('parses CSV with flexible header names and normalizes rows', async () => {
    const csvContent = `
Hotel,Score,Date,Liked,Disliked,Comments,Country
Olympic Hotel Paddington,9.2,2026-01-10,Awesome service,Street noise,Enjoyed our stay,Australia
Venus Surry Hills,7.5,2026-01-11,Clean room,Small shower,Decent hotel,UK
    `.trim();

    const { validRecords, failedRows, detectedMapping } = await parseCsv(csvContent);

    expect(failedRows.length).toBe(0);
    expect(validRecords.length).toBe(2);
    expect(validRecords[0].property_code).toBe('OLYMPIC-PADDINGTON');
    expect(validRecords[0].rating).toBe(9.2);
    expect(validRecords[0].review_date).toBe('2026-01-10');
    expect(validRecords[0].positive_text).toBe('Awesome service');
    expect(validRecords[0].negative_text).toBe('Street noise');
    expect(validRecords[1].property_code).toBe('CENTRAL-SYDNEY');
  });

  it('reports failed rows when rating or date is invalid without crashing entire file', async () => {
    const csvContent = `
hotel,rating,review_date,positive_text
Olympic Hotel Paddington,invalid_score,2026-01-10,Nice
Olympic Hotel Paddington,15.0,2026-01-10,Out of bounds
Olympic Hotel Paddington,8.0,invalid-date,Good
Olympic Hotel Paddington,8.5,2026-01-10,Valid row
    `.trim();

    const { validRecords, failedRows } = await parseCsv(csvContent);

    expect(validRecords.length).toBe(1);
    expect(failedRows.length).toBe(3);
    expect(failedRows[0].error).toContain('Invalid rating');
    expect(failedRows[1].error).toContain('Rating out of range');
    expect(failedRows[2].error).toContain('Invalid date format');
  });
});

describe('JSON Parser Unit Tests', () => {
  it('parses structured JSON array of reviews', () => {
    const jsonPayload = [
      {
        property: 'Darling Harbour',
        rating: 9.0,
        review_date: '2026-02-15',
        positive_text: 'Spectacular views',
        negative_text: null,
      },
      {
        property: 'Potts Point',
        rating: 6.5,
        review_date: '2026-02-16',
        positive_text: 'Charming neighbourhood',
        negative_text: 'No elevator',
      },
    ];

    const { validRecords, failedRows } = parseJson(jsonPayload);
    expect(failedRows.length).toBe(0);
    expect(validRecords.length).toBe(2);
    expect(validRecords[0].property_code).toBe('DARLING-HARBOUR');
    expect(validRecords[1].property_code).toBe('POTTS-POINT');
  });
});

describe('Collection Adapter Architecture Tests', () => {
  it('registers all adapters and verifies Playwright is disabled by default', () => {
    const manager = new CollectionAdapterManager();
    const adapters = manager.listAdapters();

    expect(adapters.some(a => a.name === 'csv_import' && a.enabled === true)).toBe(true);
    expect(adapters.some(a => a.name === 'json_import' && a.enabled === true)).toBe(true);

    const pw = manager.getAdapter('playwright');
    expect(pw.isEnabled()).toBe(false);
  });

  it('refuses to run automated collection when authorization is absent', async () => {
    const manager = new CollectionAdapterManager();
    const pw = manager.getAdapter('playwright');
    const result = await pw.collect();
    expect(result.enabled).toBe(false);
    expect(result.message).toContain('NOT authorized');
  });
});

describe('Synthetic Data Generator Tests', () => {
  it('generates at least 200 synthetic reviews clearly flagged with synthetic provenance', () => {
    const synthetic = generateSyntheticReviews(200);
    expect(synthetic.length).toBe(200);

    for (const r of synthetic) {
      expect(r.synthetic).toBe(true);
      expect(r.provenance.synthetic).toBe(true);
      expect(r.provenance.disclaimer).toContain('SYNTHETIC TEST DATA');
      expect(r.rating).toBeGreaterThanOrEqual(0);
      expect(r.rating).toBeLessThanOrEqual(10);
      expect(r.review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    // Verify all 4 properties represented
    const codes = new Set(synthetic.map(s => s.property_code));
    expect(codes.size).toBe(4);
  });
});

