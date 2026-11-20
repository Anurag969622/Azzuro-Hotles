-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Project: AZZURRO INSIGHTS
-- Description: Core schema definition with UUIDs, constraints, and indexes.
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC for storage
SET timezone = 'UTC';

-- ------------------------------------------------------------------------------
-- 1. PROPERTIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    booking_url TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Australia',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Australia/Sydney',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ------------------------------------------------------------------------------
-- 2. COLLECTION_BATCHES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('csv_import', 'json_import', 'playwright_authorized', 'manual_entry')),
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    total_records INTEGER NOT NULL DEFAULT 0 CHECK (total_records >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. REVIEWS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'booking.com',
    source_review_id VARCHAR(255),
    fingerprint VARCHAR(64) NOT NULL,
    rating NUMERIC(4, 2) NOT NULL CHECK (rating >= 0 AND rating <= 10),
    review_date DATE NOT NULL,
    positive_text TEXT,
    negative_text TEXT,
    full_text TEXT,
    language VARCHAR(10) DEFAULT 'en',
    reviewer_country VARCHAR(100),
    room_type VARCHAR(255),
    travel_type VARCHAR(100),
    provenance JSONB DEFAULT '{}'::jsonb,
    collection_batch_id UUID REFERENCES collection_batches(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Unique index for deduplication:
-- 1) Prevent duplicate source_review_id per property & source if present
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_source_unique 
    ON reviews (property_id, source, source_review_id) 
    WHERE source_review_id IS NOT NULL;

-- 2) Prevent duplicate content via fingerprint per property
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_fingerprint_unique 
    ON reviews (property_id, fingerprint);

-- Indexes for frequent analytical queries
CREATE INDEX IF NOT EXISTS idx_reviews_property_id ON reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_collected_at ON reviews(collected_at);
CREATE INDEX IF NOT EXISTS idx_reviews_batch_id ON reviews(collection_batch_id);

-- ------------------------------------------------------------------------------
-- 4. REVIEW_ANALYSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    overall_sentiment VARCHAR(20) NOT NULL CHECK (overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_confidence NUMERIC(5, 4) NOT NULL CHECK (sentiment_confidence >= 0 AND sentiment_confidence <= 1),
    detected_language VARCHAR(10) DEFAULT 'en',
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    analysis_status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed', 'superseded')),
    manually_verified BOOLEAN NOT NULL DEFAULT false,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Allow re-analysis history but index review_id
CREATE INDEX IF NOT EXISTS idx_review_analyses_review_id ON review_analyses(review_id);
CREATE INDEX IF NOT EXISTS idx_review_analyses_sentiment ON review_analyses(overall_sentiment);
CREATE INDEX IF NOT EXISTS idx_review_analyses_analyzed_at ON review_analyses(analyzed_at);

-- ------------------------------------------------------------------------------
-- 5. REVIEW_TOPICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    topic_name VARCHAR(100) NOT NULL,
    topic_sentiment VARCHAR(20) NOT NULL CHECK (topic_sentiment IN ('positive', 'neutral', 'negative')),
    confidence NUMERIC(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Prevent duplicate review-topic combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_topics_unique 
    ON review_topics (review_id, topic_name);

CREATE INDEX IF NOT EXISTS idx_review_topics_name ON review_topics(topic_name);
CREATE INDEX IF NOT EXISTS idx_review_topics_sentiment ON review_topics(topic_sentiment);

-- ------------------------------------------------------------------------------
-- 6. COLLECTION_LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    collection_batch_id UUID REFERENCES collection_batches(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'success', 'warning', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    fetched_count INTEGER NOT NULL DEFAULT 0 CHECK (fetched_count >= 0),
    inserted_count INTEGER NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
    duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
    rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
    error_details JSONB
);

CREATE INDEX IF NOT EXISTS idx_collection_logs_property_id ON collection_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_started_at ON collection_logs(started_at);

-- ------------------------------------------------------------------------------
-- 7. MANUAL_CORRECTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    target_entity VARCHAR(50) NOT NULL CHECK (target_entity IN ('review_analysis', 'review_topic', 'review_content')),
    entity_id UUID,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    corrected_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_manual_corrections_review_id ON manual_corrections(review_id);

-- ------------------------------------------------------------------------------
-- 8. SCHEDULED_JOBS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) UNIQUE NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    cron_expression VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status VARCHAR(50) CHECK (last_status IN ('success', 'running', 'failed')),
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ------------------------------------------------------------------------------
-- Automatic updated_at Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
CREATE TRIGGER trg_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trg_scheduled_jobs_updated_at
    BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

