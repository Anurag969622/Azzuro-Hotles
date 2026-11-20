'use strict';

const fs = require('fs');
const path = require('path');
const { getPool, query } = require('../database/connection');
const logger = require('../../config/logger');

const PROPERTIES_SEED_DATA = [
  {
    property_code: 'OLYMPIC-PADDINGTON',
    name: 'Olympic Hotel Paddington',
    booking_url: 'https://www.booking.com/hotel/au/olympic-paddington.html',
    location: 'Paddington, Sydney, NSW',
    country: 'Australia',
    timezone: 'Australia/Sydney',
  },
  {
    property_code: 'POTTS-POINT',
    name: 'Potts Point',
    booking_url: 'https://www.booking.com/hotel/au/venus-potts-point-sydney.html',
    location: 'Potts Point, Sydney, NSW',
    country: 'Australia',
    timezone: 'Australia/Sydney',
  },
  {
    property_code: 'CENTRAL-SYDNEY',
    name: 'Central Sydney',
    booking_url: 'https://www.booking.com/hotel/au/venus-surry-hills.html',
    location: 'Surry Hills, Sydney, NSW',
    country: 'Australia',
    timezone: 'Australia/Sydney',
  },
  {
    property_code: 'DARLING-HARBOUR',
    name: 'Darling Harbour',
    booking_url: 'https://www.booking.com/hotel/au/chateau-de-venus.html',
    location: 'Darling Harbour, Sydney, NSW',
    country: 'Australia',
    timezone: 'Australia/Sydney',
  },
];

async function seedProperties() {
  const p = getPool();
  if (!p) {
    logger.warn('Database pool not active. Cannot seed properties into live DB.');
    return;
  }

  logger.info('Starting idempotent seeding of Azzurro properties...');

  for (const prop of PROPERTIES_SEED_DATA) {
    const sql = `
      INSERT INTO properties (
        property_code, name, booking_url, location, country, timezone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (property_code) DO UPDATE SET
        name = EXCLUDED.name,
        booking_url = EXCLUDED.booking_url,
        location = EXCLUDED.location,
        country = EXCLUDED.country,
        timezone = EXCLUDED.timezone,
        is_active = EXCLUDED.is_active,
        updated_at = timezone('utc', now())
      RETURNING id, property_code, name;
    `;

    const res = await query(sql, [
      prop.property_code,
      prop.name,
      prop.booking_url,
      prop.location,
      prop.country,
      prop.timezone,
    ]);

    logger.info(`Seeded property: ${res.rows[0].property_code} (${res.rows[0].id})`);
  }

  logger.info('All 4 properties seeded successfully.');
}

if (require.main === module) {
  seedProperties()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Seed script failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { seedProperties, PROPERTIES_SEED_DATA };

