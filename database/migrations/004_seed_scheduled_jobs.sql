-- ==============================================================================
-- Migration: 004_seed_scheduled_jobs.sql
-- Project: AZZURRO INSIGHTS
-- Description: Idempotent seed migration for scheduled jobs in Australia/Sydney timezone.
-- ==============================================================================

INSERT INTO scheduled_jobs (
    job_name,
    job_type,
    cron_expression,
    is_active,
    last_status,
    failure_count,
    metadata
) VALUES
(
    'daily_collection_all',
    'collection_and_analysis',
    '0 2 * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "scope": "all_properties", "retry_max": 3, "description": "Nightly multi-property review collection and local AI sentiment classification at 2:00 AM Sydney AEST"}'::jsonb
),
(
    'weekly_analytics_reporting',
    'reporting_sync',
    '0 3 * * 1',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "scope": "portfolio_weekly", "retry_max": 2, "description": "Weekly management analytics aggregation and KPI generation every Monday at 3:00 AM Sydney AEST"}'::jsonb
),
(
    'ai_queue_processing',
    'queue_processing',
    '*/30 * * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "scope": "unanalyzed_reviews", "batch_size": 50, "description": "Recurring background queue worker for pending AI sentiment and topic classification"}'::jsonb
),
(
    'property_collection_olympic_paddington',
    'property_collection',
    '0 2 * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "property_code": "OLYMPIC-PADDINGTON", "description": "Isolated ingestion job for Olympic Hotel Paddington"}'::jsonb
),
(
    'property_collection_potts_point',
    'property_collection',
    '10 2 * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "property_code": "POTTS-POINT", "description": "Isolated ingestion job for Potts Point"}'::jsonb
),
(
    'property_collection_central_sydney',
    'property_collection',
    '20 2 * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "property_code": "CENTRAL-SYDNEY", "description": "Isolated ingestion job for Central Sydney"}'::jsonb
),
(
    'property_collection_darling_harbour',
    'property_collection',
    '30 2 * * *',
    true,
    'success',
    0,
    '{"timezone": "Australia/Sydney", "property_code": "DARLING-HARBOUR", "description": "Isolated ingestion job for Darling Harbour"}'::jsonb
)
ON CONFLICT (job_name) DO UPDATE SET
    cron_expression = EXCLUDED.cron_expression,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata,
    updated_at = timezone('utc', now());
