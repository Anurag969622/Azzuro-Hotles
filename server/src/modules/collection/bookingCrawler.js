'use strict';

/**
 * bookingCrawler.js
 *
 * Automated Booking.com review collector using HTTP + Cheerio HTML parsing.
 *
 * HOW IT WORKS:
 *   1. Fetches the hotel review page URL with realistic browser headers.
 *   2. Parses HTML review containers with Cheerio.
 *   3. Returns normalized review records ready for ingestion.
 *   4. Gracefully returns empty results (with a warning) if Booking.com
 *      blocks the request (403, CAPTCHA, bot-detection).
 *   5. Tracks the latest fetched review date per property to detect NEW reviews.
 *
 * LEGAL NOTE:
 *   Booking.com's public review data is freely viewable by any browser user.
 *   This crawler mimics a standard browser request (User-Agent, Accept headers).
 *   It does NOT solve CAPTCHAs, bypass login walls, or access authenticated endpoints.
 *   For guaranteed authorized access, use the Booking.com Connectivity Partner API.
 *
 * CAPTCHA / 403 HANDLING:
 *   If Booking.com returns a bot-detection page or HTTP 403, the crawler logs a
 *   warning and returns an empty result set — it NEVER attempts to bypass the check.
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const logger = require('../../config/logger');

// ── Property configuration ────────────────────────────────────────────────────

const PROPERTY_CONFIG = {
  'OLYMPIC-PADDINGTON': {
    name: 'Olympic Hotel Paddington',
    reviewPageUrl: 'https://www.booking.com/hotel/au/olympic-paddington.html',
    reviewsTab: '#reviews_wrapper',
    pageSize: 10,
  },
  'POTTS-POINT': {
    name: 'Venus Potts Point Sydney',
    reviewPageUrl: 'https://www.booking.com/hotel/au/venus-potts-point-sydney.html',
    reviewsTab: '#reviews_wrapper',
    pageSize: 10,
  },
  'CENTRAL-SYDNEY': {
    name: 'Venus Surry Hills (Central Sydney)',
    reviewPageUrl: 'https://www.booking.com/hotel/au/venus-surry-hills.html',
    reviewsTab: '#reviews_wrapper',
    pageSize: 10,
  },
  'DARLING-HARBOUR': {
    name: 'Chateau de Venus (Darling Harbour)',
    reviewPageUrl: 'https://www.booking.com/hotel/au/chateau-de-venus.html',
    reviewsTab: '#reviews_wrapper',
    pageSize: 10,
  },
};

// Realistic browser headers to avoid trivial bot-detection rejections
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Cache-Control': 'max-age=0',
  'Upgrade-Insecure-Requests': '1',
  Referer: 'https://www.booking.com/',
  'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not-A.Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
};

// ── Helper: delay ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Core crawler class ────────────────────────────────────────────────────────

class BookingCrawler {
  constructor() {
    this.requestDelayMs = parseInt(process.env.CRAWLER_DELAY_MS || '2500', 10);
    this.timeoutMs = parseInt(process.env.CRAWLER_TIMEOUT_MS || '20000', 10);
    this.maxPages = parseInt(process.env.CRAWLER_MAX_PAGES || '5', 10);
  }

  /**
   * Returns the property config for a given property code.
   */
  getPropertyConfig(propertyCode) {
    const cfg = PROPERTY_CONFIG[propertyCode];
    if (!cfg) {
      throw new Error(
        `No Booking.com URL configured for property code: "${propertyCode}". ` +
          `Supported: ${Object.keys(PROPERTY_CONFIG).join(', ')}`
      );
    }
    return cfg;
  }

  /**
   * Fetches HTML from a URL and returns the Cheerio document or null if blocked.
   */
  async fetchPage(url, attempt = 1) {
    logger.info(`[BookingCrawler] Fetching (attempt ${attempt}): ${url}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      // Handle HTTP-level blocks
      if (response.status === 403 || response.status === 429) {
        logger.warn(
          `[BookingCrawler] Booking.com returned HTTP ${response.status} (rate-limit or bot-detection). ` +
            `Skipping fetch — will NOT attempt bypass. Use Booking.com Partner API for authorized access.`
        );
        return null;
      }

      if (!response.ok) {
        logger.warn(`[BookingCrawler] Unexpected HTTP ${response.status} for ${url}`);
        return null;
      }

      const html = await response.text();

      // Detect JavaScript challenge / CAPTCHA pages
      if (this._isCaptchaPage(html)) {
        logger.warn(
          `[BookingCrawler] Booking.com returned a bot-detection / CAPTCHA page for ${url}. ` +
            `Returning empty results. CAPTCHA bypass is NOT attempted (system policy).`
        );
        return null;
      }

      return cheerio.load(html);
    } catch (err) {
      if (err.name === 'AbortError') {
        logger.warn(`[BookingCrawler] Request timed out for ${url}`);
      } else {
        logger.warn(`[BookingCrawler] Network error for ${url}: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Detects known CAPTCHA / bot-detection markers in the HTML body.
   * Returns true if the page is a challenge page (not actual reviews).
   */
  _isCaptchaPage(html) {
    const signals = [
      'cf-browser-verification',
      'cf_chl_opt',
      '__cf_chl',
      'challenge-form',
      'turnstile',
      'hcaptcha',
      'g-recaptcha',
      'Please verify you are a human',
      'Enable JavaScript and cookies',
      'DDoS protection by Cloudflare',
      'perimeterx',
      'px-captcha',
      'Access denied',
      'Checking your browser',
    ];
    const lower = html.toLowerCase();
    return signals.some((s) => lower.includes(s.toLowerCase()));
  }

  /**
   * Parses review items from a Booking.com hotel page.
   * Booking.com uses several different review section layouts —
   * we try multiple known selectors.
   */
  _parseReviews($, propertyCode, propertyName) {
    const reviews = [];

    // Booking.com review selectors (they change their HTML frequently)
    const containers = [
      '[data-testid="review-card"]',
      '.c-review-block',
      '.bui-card__content .review_list_new_item_block',
      '.review_list_new_item_block',
      '[itemprop="review"]',
      '.js-review-block',
    ];

    let items = null;
    for (const selector of containers) {
      const found = $(selector);
      if (found.length > 0) {
        logger.info(`[BookingCrawler] Found ${found.length} review(s) using selector "${selector}"`);
        items = found;
        break;
      }
    }

    if (!items || items.length === 0) {
      logger.warn(
        `[BookingCrawler] No review containers found on page for "${propertyCode}". ` +
          `Booking.com may have changed its HTML structure or returned a redirect page.`
      );
      return [];
    }

    items.each((_, el) => {
      try {
        const $el = $(el);

        // Reviewer name
        const reviewer = (
          $el.find('[data-testid="review-author"]').text() ||
          $el.find('.bui-avatar-block__title').text() ||
          $el.find('.reviewer_name').text() ||
          $el.find('[class*="reviewer"]').first().text() ||
          'Anonymous Guest'
        ).trim();

        // Rating score (Booking.com uses scores out of 10)
        const rawScore =
          $el.find('[data-testid="review-score"]').text() ||
          $el.find('.bui-review-score__badge').text() ||
          $el.find('.c-score').text() ||
          $el.find('[class*="score"]').first().text() ||
          '';
        const scoreRaw = parseFloat(rawScore.replace(/[^0-9.]/g, ''));
        // Booking.com ratings are 0 - 10
        const rating = !isNaN(scoreRaw) && scoreRaw > 0
          ? Math.min(10, Math.max(1, Math.round(scoreRaw * 10) / 10))
          : 8.0;

        // Review date
        const rawDate =
          $el.find('[data-testid="review-date"]').attr('datetime') ||
          $el.find('time').attr('datetime') ||
          $el.find('.c-review-block__date').text() ||
          $el.find('[class*="date"]').first().text() ||
          '';
        const reviewDate = this._parseDate(rawDate);

        // Positive / negative text (Booking.com splits reviews into pros/cons)
        const positiveText = (
          $el.find('[data-testid="review-positive-text"]').text() ||
          $el.find('.c-review__prefixed .c-review--positive').text() ||
          $el.find('.review_pos').text() ||
          ''
        ).trim();

        const negativeText = (
          $el.find('[data-testid="review-negative-text"]').text() ||
          $el.find('.c-review__prefixed .c-review--negative').text() ||
          $el.find('.review_neg').text() ||
          ''
        ).trim();

        // Combine into full review text
        const fullText = [
          positiveText ? `Liked: ${positiveText}` : '',
          negativeText ? `Disliked: ${negativeText}` : '',
        ]
          .filter(Boolean)
          .join(' | ') || null;

        // Reviewer nationality / country
        const country = (
          $el.find('[data-testid="review-country"]').text() ||
          $el.find('.bui-avatar-block__subtitle').text() ||
          $el.find('.reviewer_country').text() ||
          ''
        ).trim() || null;

        // Title (some layouts have it)
        const title = (
          $el.find('[data-testid="review-title"]').text() ||
          $el.find('.c-review-block__title').text() ||
          $el.find('.review_list_new_item_block__title').text() ||
          ''
        ).trim() || null;

        const externalId = this._generateExternalId(propertyCode, reviewer, reviewDate, fullText);

        // Build normalized record
        const record = {
          property: propertyCode,
          property_code: propertyCode,
          source: 'booking_com',
          reviewer_name: reviewer || 'Anonymous Guest',
          reviewer_country: country,
          rating: rating,
          title: title,
          full_text: fullText,
          positive_text: positiveText || null,
          negative_text: negativeText || null,
          review_date: reviewDate,
          language: 'en',
          source_review_id: externalId,
          external_id: externalId,
          raw_data: {
            scraped_at: new Date().toISOString(),
            source_url: PROPERTY_CONFIG[propertyCode]?.reviewPageUrl,
            property_name: propertyName,
            raw_score: scoreRaw || null,
          },
        };

        // Only include reviews that have at least some text content
        if (fullText || positiveText || negativeText) {
          reviews.push(record);
        }
      } catch (parseErr) {
        logger.debug(`[BookingCrawler] Skipped one review item due to parse error: ${parseErr.message}`);
      }
    });

    return reviews;
  }

  /**
   * Attempts to parse a date string into ISO format.
   */
  _parseDate(raw) {
    if (!raw) return new Date().toISOString().split('T')[0];
    try {
      const d = new Date(raw.trim());
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (_) {}

    // Try common formats like "November 2024", "12 November 2024"
    const monthMatch = raw.match(/(\d{1,2})?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})/i);
    if (monthMatch) {
      const day = monthMatch[1] || '1';
      const month = monthMatch[2];
      const year = monthMatch[3];
      const d = new Date(`${day} ${month} ${year}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Generates a stable external_id for deduplication based on key fields.
   * This is a simple hash-like string — the ingestion service also does SHA-256 on full content.
   */
  _generateExternalId(propertyCode, reviewer, date, text) {
    const raw = `${propertyCode}::${reviewer}::${date}::${(text || '').substring(0, 100)}`;
    // Simple deterministic hash without crypto (crypto.createHash used in ingestion service)
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash + char) >>> 0;
    }
    return `bcom_${propertyCode.toLowerCase()}_${hash.toString(16)}`;
  }

  /**
   * Attempts to navigate to pagination page N on Booking.com.
   * Returns modified URL with pagination offset.
   */
  _paginateUrl(baseUrl, page, pageSize) {
    const offset = page * pageSize;
    const url = new URL(baseUrl);
    url.searchParams.set('offset', offset.toString());
    return url.toString();
  }

  /**
   * Main entry point: crawl all review pages for a given property code.
   * Returns { records, metadata } ready for the adapter interface.
   */
  async crawlProperty(propertyCode, options = {}) {
    const { sinceDate = null, maxPages = this.maxPages } = options;
    const cfg = this.getPropertyConfig(propertyCode);

    logger.info(
      `[BookingCrawler] Starting review crawl for "${propertyCode}" (${cfg.name}). ` +
        `Max pages: ${maxPages}. URL: ${cfg.reviewPageUrl}`
    );

    const allReviews = [];
    let pagesScraped = 0;
    let blocked = false;

    for (let page = 0; page < maxPages; page++) {
      const url =
        page === 0 ? cfg.reviewPageUrl : this._paginateUrl(cfg.reviewPageUrl, page, cfg.pageSize);

      // Polite delay between requests (except first)
      if (page > 0) {
        logger.debug(`[BookingCrawler] Waiting ${this.requestDelayMs}ms before next page...`);
        await sleep(this.requestDelayMs);
      }

      const $ = await this.fetchPage(url, page + 1);

      if (!$ ) {
        // Blocked or failed — stop crawling this property
        blocked = true;
        logger.warn(
          `[BookingCrawler] Stopping crawl for "${propertyCode}" — page ${page + 1} returned no parseable content.`
        );
        break;
      }

      const pageReviews = this._parseReviews($, propertyCode, cfg.name);
      pagesScraped++;

      if (pageReviews.length === 0) {
        // No more reviews on this page — stop pagination
        logger.info(`[BookingCrawler] No reviews found on page ${page + 1}. Stopping pagination.`);
        break;
      }

      // If sinceDate filter is applied, only keep newer reviews
      const filtered = sinceDate
        ? pageReviews.filter((r) => !r.review_date || r.review_date >= sinceDate)
        : pageReviews;

      allReviews.push(...filtered);

      // If we got fewer than pageSize items, we've likely reached the last page
      if (pageReviews.length < cfg.pageSize) {
        logger.info(`[BookingCrawler] Reached last page for "${propertyCode}" (got ${pageReviews.length} < ${cfg.pageSize}).`);
        break;
      }
    }

    logger.info(
      `[BookingCrawler] Crawl complete for "${propertyCode}". ` +
        `Pages scraped: ${pagesScraped}. Reviews found: ${allReviews.length}. Blocked: ${blocked}.`
    );

    return {
      records: allReviews,
      metadata: {
        source: 'booking_com_crawler',
        propertyCode,
        propertyName: cfg.name,
        sourceUrl: cfg.reviewPageUrl,
        pagesScraped,
        blocked,
        crawledAt: new Date().toISOString(),
        reviewCount: allReviews.length,
      },
    };
  }
}

// Singleton export
module.exports = new BookingCrawler();
