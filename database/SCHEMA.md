# Database Documentation & Entity-Relationship Model

**Platform:** AZZURRO INSIGHTS
**Database Engine:** Supabase PostgreSQL
**Timezone Policy:** All timestamps stored in `UTC`, reporting viewed in `Australia/Sydney`.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    PROPERTIES ||--o{ REVIEWS : "collects"
    PROPERTIES ||--o{ COLLECTION_BATCHES : "receives"
    PROPERTIES ||--o{ COLLECTION_LOGS : "logs"

    COLLECTION_BATCHES ||--o{ REVIEWS : "groups"
    COLLECTION_BATCHES ||--o{ COLLECTION_LOGS : "records"

    REVIEWS ||--o{ REVIEW_ANALYSES : "evaluated_by"
    REVIEWS ||--o{ REVIEW_TOPICS : "tagged_with"
    REVIEWS ||--o{ MANUAL_CORRECTIONS : "audited_by"

    SCHEDULED_JOBS {
        uuid id PK
        varchar job_name UK
        varchar job_type
        varchar cron_expression
        boolean is_active
        timestamptz last_run_at
        timestamptz next_run_at
        varchar last_status
        int failure_count
        jsonb metadata
    }

    PROPERTIES {
        uuid id PK
        varchar property_code UK
        varchar name
        text booking_url
        varchar location
        varchar country
        varchar timezone
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    COLLECTION_BATCHES {
        uuid id PK
        uuid property_id FK
        varchar batch_name
        varchar source
        varchar file_name
        bigint file_size_bytes
        int total_records
        varchar status
        jsonb metadata
        timestamptz created_at
        timestamptz completed_at
    }

    REVIEWS {
        uuid id PK
        uuid property_id FK
        varchar source
        varchar source_review_id
        varchar fingerprint
        numeric rating
        date review_date
        text positive_text
        text negative_text
        text full_text
        varchar language
        varchar reviewer_country
        varchar room_type
        varchar travel_type
        jsonb provenance
        uuid collection_batch_id FK
        timestamptz collected_at
        timestamptz created_at
        timestamptz updated_at
    }

    REVIEW_ANALYSES {
        uuid id PK
        uuid review_id FK
        varchar overall_sentiment
        numeric sentiment_confidence
        varchar detected_language
        varchar model_name
        varchar model_version
        varchar analysis_status
        boolean manually_verified
        timestamptz analyzed_at
    }

    REVIEW_TOPICS {
        uuid id PK
        uuid review_id FK
        varchar topic_name
        varchar topic_sentiment
        numeric confidence
        timestamptz created_at
    }

    COLLECTION_LOGS {
        uuid id PK
        uuid property_id FK
        uuid collection_batch_id FK
        varchar source
        varchar status
        timestamptz started_at
        timestamptz completed_at
        int fetched_count
        int inserted_count
        int duplicate_count
        int rejected_count
        jsonb error_details
    }

    MANUAL_CORRECTIONS {
        uuid id PK
        uuid review_id FK
        varchar target_entity
        uuid entity_id
        varchar field_name
        text old_value
        text new_value
        text reason
        varchar corrected_by
        timestamptz created_at
    }
```

---

## 2. Table Specifications & Indexes

### 1. `properties`
Stores the four managed hotel properties.
- **Primary Key:** `id` (UUID)
- **Unique:** `property_code`
- **Seeded Records:**
  1. `OLYMPIC-PADDINGTON` — Olympic Hotel Paddington
  2. `POTTS-POINT` — Potts Point
  3. `CENTRAL-SYDNEY` — Central Sydney
  4. `DARLING-HARBOUR` — Darling Harbour

### 2. `collection_batches`
Tracks files and jobs during review ingestion.
- **Foreign Key:** `property_id -> properties(id) ON DELETE CASCADE`
- **Check Constraints:** `source IN ('csv_import', 'json_import', 'playwright_authorized', 'manual_entry')`

### 3. `reviews`
Single source of truth for all guest reviews.
- **Foreign Key:** `property_id -> properties(id) ON DELETE CASCADE`, `collection_batch_id -> collection_batches(id) ON DELETE SET NULL`
- **Deduplication:**
  - Unique index on `(property_id, source, source_review_id)` where source ID exists.
  - Unique index on `(property_id, fingerprint)` to catch identical review text hashes.
- **Indexes:**
  - `idx_reviews_property_id` on `property_id`
  - `idx_reviews_review_date` on `review_date`
  - `idx_reviews_rating` on `rating`
  - `idx_reviews_collected_at` on `collected_at`

### 4. `review_analyses`
Historical and current sentiment classification per review.
- **Foreign Key:** `review_id -> reviews(id) ON DELETE CASCADE`
- **Check Constraints:** `overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')`, confidence `0 <= val <= 1`.
- **Indexes:**
  - `idx_review_analyses_review_id`
  - `idx_review_analyses_sentiment`

### 5. `review_topics`
Extracted operational topics (e.g. cleanliness, staff, location, wifi).
- **Foreign Key:** `review_id -> reviews(id) ON DELETE CASCADE`
- **Constraint:** Unique index on `(review_id, topic_name)` preventing duplicate topics per review.

### 6. `collection_logs`
Audit trails for data collection runs.
- **Check Constraints:** `status IN ('started', 'success', 'warning', 'failed')`

### 7. `manual_corrections`
Full audit trail of human edits, overrides, or sentiment adjustments.
- **Foreign Key:** `review_id -> reviews(id) ON DELETE CASCADE`

### 8. `scheduled_jobs`
Metadata and execution statuses for background cron jobs.

---

## 3. Row Level Security (RLS) Strategy

- **Privileged backend operations:** Use Supabase `service_role` key via Node.js backend. All mutations bypass RLS through the server.
- **Anonymous client access:** Strict read-only access on active properties, completed review analyses, and topics. Zero insert/update/delete capabilities.
- **Future Manager / Admin Roles:**
  - Hotel managers have read-only access.
  - Authorized admins possess permissions to submit manual corrections and inspect collection logs.

