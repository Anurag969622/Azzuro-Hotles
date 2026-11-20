'use strict';

/**
 * Base Collection Adapter Interface
 */
class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Whether this adapter is authorized and enabled.
   */
  isEnabled() {
    return true;
  }

  /**
   * Fetches/collects raw records.
   * @param {Object} options
   * @returns {Promise<{ records: Object[], metadata: Object }>}
   */
  async collect(options = {}) {
    throw new Error('collect() must be implemented by adapter subclass');
  }
}

/**
 * CSV Collection Adapter
 */
class CsvAdapter extends BaseAdapter {
  constructor() {
    super('csv_import');
  }

  async collect({ fileBuffer, fileName, mapping, defaultPropertyCode }) {
    const { parseCsv } = require('./csvParser');
    const records = await parseCsv(fileBuffer, { mapping, defaultPropertyCode });
    return {
      records,
      metadata: { fileName, source: 'csv_import' },
    };
  }
}

/**
 * JSON Collection Adapter
 */
class JsonAdapter extends BaseAdapter {
  constructor() {
    super('json_import');
  }

  async collect({ jsonPayload, fileName, defaultPropertyCode }) {
    const { parseJson } = require('./jsonParser');
    const records = parseJson(jsonPayload, { defaultPropertyCode });
    return {
      records,
      metadata: { fileName: fileName || 'direct_payload.json', source: 'json_import' },
    };
  }
}

/**
 * Optional Partner Data Adapter (e.g. Authorized PMS / Booking Partner API)
 */
class PartnerAdapter extends BaseAdapter {
  constructor() {
    super('partner_api');
  }

  isEnabled() {
    return Boolean(process.env.PARTNER_API_KEY && process.env.PARTNER_API_ENDPOINT);
  }

  async collect(options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Partner API adapter is not configured. Set PARTNER_API_KEY and PARTNER_API_ENDPOINT.');
    }
    // Stub for authorized hotel PMS API integration
    return {
      records: [],
      metadata: { source: 'partner_api', note: 'Authorized PMS integration ready' },
    };
  }
}

/**
 * Optional Playwright Adapter
 * Strictly disabled by default per system guidelines and terms of service.
 */
class PlaywrightAdapter extends BaseAdapter {
  constructor() {
    super('playwright_authorized');
  }

  isEnabled() {
    // Only enabled if explicit written authorization flag is confirmed
    return (
      process.env.PLAYWRIGHT_ENABLED === 'true' &&
      Boolean(process.env.PLAYWRIGHT_AUTH_TOKEN)
    );
  }

  async collect(options = {}) {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        records: [],
        message: 'Live automated browser collection is NOT authorized or enabled. Automated collection without written permission violates terms of service. Use CSV or JSON import instead.',
      };
    }

    throw new Error('Automated browser collection requires verified written authorization and explicit implementation parameters.');
  }
}

/**
 * Automated Booking.com Crawler Adapter
 * Directly crawls configured Booking.com review pages for the 4 Azzurro properties.
 */
class BookingCrawlerAdapter extends BaseAdapter {
  constructor() {
    super('booking_crawler');
  }

  isEnabled() {
    return process.env.BOOKING_CRAWLER_ENABLED !== 'false';
  }

  async collect(options = {}) {
    const bookingCrawler = require('./bookingCrawler');
    const { propertyCode, sinceDate, maxPages } = options;
    if (!propertyCode) {
      throw new Error('propertyCode is required for Booking.com crawler');
    }
    return await bookingCrawler.crawlProperty(propertyCode, { sinceDate, maxPages });
  }
}

/**
 * Adapter Registry
 */
class CollectionAdapterManager {
  constructor() {
    this.adapters = {
      csv: new CsvAdapter(),
      json: new JsonAdapter(),
      partner: new PartnerAdapter(),
      playwright: new PlaywrightAdapter(),
      booking: new BookingCrawlerAdapter(),
    };
  }

  getAdapter(name) {
    const adapter = this.adapters[name];
    if (!adapter) {
      throw new Error(`Unknown collection adapter: "${name}". Available: ${Object.keys(this.adapters).join(', ')}`);
    }
    return adapter;
  }

  listAdapters() {
    return Object.entries(this.adapters).map(([key, adapter]) => ({
      key,
      name: adapter.name,
      enabled: adapter.isEnabled(),
    }));
  }
}

module.exports = {
  BaseAdapter,
  CsvAdapter,
  JsonAdapter,
  PartnerAdapter,
  PlaywrightAdapter,
  BookingCrawlerAdapter,
  CollectionAdapterManager,
};

