-- ==============================================================================
-- Migration: 002_seed_properties.sql
-- Project: AZZURRO INSIGHTS
-- Description: Idempotent seed migration for the four Azzurro Hotel properties.
-- ==============================================================================

INSERT INTO properties (
    property_code,
    name,
    booking_url,
    location,
    country,
    timezone,
    is_active
) VALUES
(
    'OLYMPIC-PADDINGTON',
    'Olympic Hotel Paddington',
    'https://www.booking.com/hotel/au/olympic-paddington.html',
    'Paddington, Sydney, NSW',
    'Australia',
    'Australia/Sydney',
    true
),
(
    'POTTS-POINT',
    'Potts Point',
    'https://www.booking.com/hotel/au/venus-potts-point-sydney.html',
    'Potts Point, Sydney, NSW',
    'Australia',
    'Australia/Sydney',
    true
),
(
    'CENTRAL-SYDNEY',
    'Central Sydney',
    'https://www.booking.com/hotel/au/venus-surry-hills.html',
    'Surry Hills, Sydney, NSW',
    'Australia',
    'Australia/Sydney',
    true
),
(
    'DARLING-HARBOUR',
    'Darling Harbour',
    'https://www.booking.com/hotel/au/chateau-de-venus.html',
    'Darling Harbour, Sydney, NSW',
    'Australia',
    'Australia/Sydney',
    true
)
ON CONFLICT (property_code) DO UPDATE SET
    name = EXCLUDED.name,
    booking_url = EXCLUDED.booking_url,
    location = EXCLUDED.location,
    country = EXCLUDED.country,
    timezone = EXCLUDED.timezone,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
