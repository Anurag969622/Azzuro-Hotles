# AZZURRO INSIGHTS — Backend REST API Specification

Base URLs:
- `/api/v1` (Versioned standard API)
- `/api` (Exact specification alias routes)

All requests and responses use `application/json` unless otherwise noted (such as multipart file uploads).

---

## 1. Properties Endpoints

### `GET /api/properties`
Returns all active hotel properties with aggregate review volume and average rating.
* **Query Parameters:** None
* **Response (200 OK):**
```json
{
  "success": true,
  "count": 4,
  "properties": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "property_code": "OLYMPIC-PADDINGTON",
      "name": "Olympic Hotel Paddington",
      "booking_url": "https://www.booking.com/hotel/au/olympic-hotel-paddington.html",
      "location": "Paddington, Sydney, NSW",
      "country": "Australia",
      "timezone": "Australia/Sydney",
      "total_reviews": 65,
      "avg_rating": 8.7
    }
  ]
}
```

### `GET /api/properties/:id`
Retrieves a single hotel property by UUID or `property_code`, including recent reviews.

---

## 2. Reviews Endpoints

### `GET /api/reviews`
Paginated, sorted, and filtered review explorer.
* **Query Parameters:**
  - `propertyCode` / `property_id` (string): Filter by property.
  - `sentiment` (string): `positive`, `negative`, `neutral`, `mixed`.
  - `rating` (string): Range filter (e.g. `9-10`, `7-8`, `<6`).
  - `start_date` / `end_date` (YYYY-MM-DD): Filter by stay/review date.
  - `topic` (string): Operational topic name filter (e.g. `Cleanliness`, `Staff Behaviour`).
  - `search` (string): Full-text keyword search in review content.
  - `page` (int, default 1) & `limit` (int, default 20, max 100).
* **Response (200 OK):**
```json
{
  "success": true,
  "total": 220,
  "count": 20,
  "page": 1,
  "limit": 20,
  "totalPages": 11,
  "reviews": [
    {
      "id": "e45a19e2-7e65-4068-8147-adaa8414f87c",
      "property_code": "OLYMPIC-PADDINGTON",
      "property_name": "Olympic Hotel Paddington",
      "rating": 9.5,
      "review_date": "2026-11-16",
      "positive_text": "Super friendly staff and perfect location!",
      "overall_sentiment": "positive",
      "sentiment_confidence": 0.95,
      "topics": [
        { "topic_name": "Staff Behaviour", "topic_sentiment": "positive", "confidence": 0.95 },
        { "topic_name": "Location", "topic_sentiment": "positive", "confidence": 0.92 }
      ]
    }
  ]
}
```

### `GET /api/reviews/:id`
Returns detailed review metadata, complete AI analysis history, topic breakdown, and audit corrections.

### `POST /api/reviews/import/csv`
Multipart file upload for CSV spreadsheets.
* **Payload:** `file` (multipart form-data, max 10MB)
* **Response:** Ingestion summary with `insertedCount`, `duplicateCount`, and `failedRows`.

### `POST /api/reviews/import/json`
Direct JSON array review ingestion.

### `POST /api/reviews/:id/reanalyze`
Re-runs local AI classification on an existing review.

### `PATCH /api/reviews/:id/correction`
Logs a manual human review correction into `manual_corrections` without overwriting the immutable original model output.

---

## 3. Analytics Endpoints

### `GET /api/analytics/overview`
Executive KPI overview for the current week vs. previous week (Australia/Sydney Monday start).
* **Response (200 OK):**
```json
{
  "success": true,
  "period": {
    "timezone": "Australia/Sydney",
    "currentWeek": { "startDate": "2026-11-16", "endDate": "2026-11-22" },
    "previousWeekEquivalent": { "startDate": "2026-11-09", "endDate": "2026-11-15" }
  },
  "kpis": {
    "currentWeekAverageRating": 8.45,
    "previousWeekAverageRating": 8.20,
    "ratingDifference": 0.25,
    "ratingTrend": "improving",
    "totalReviewCount": 220
  },
  "sentimentDistribution": {
    "percentages": { "positive": 68.2, "negative": 18.2, "mixed": 9.1, "neutral": 4.5 }
  }
}
```

### `GET /api/analytics/properties`
Side-by-side performance metrics across all 4 hotel properties.

### `GET /api/analytics/trends`
Daily rating time-series and weekly sentiment percentages over a configurable window (e.g. `?days=30`).

### `GET /api/analytics/topics`
Operational breakdown across the 16 topics with priority scores and top complaint rankings.

### `GET /api/analytics/sentiment`
Portfolio-wide and per-property sentiment distribution percentages.

---

## 4. Automation & Background Jobs Endpoints

### `GET /api/collection/status`
Returns collection adapter states, Playwright authorization status, active job locks, and AI queue size.

### `GET /api/collection/jobs`
Lists all 7 registered `node-cron` tasks with schedules, lock states, and historical statuses.

### `POST /api/collection/jobs/:jobName/run`
Triggers on-demand execution of a scheduled job with concurrency locking.

### `POST /api/collection/jobs/:jobName/toggle`
Pauses or resumes a scheduled cron job.

### `GET /api/collection/queue` & `POST /api/collection/queue/process`
Inspects unanalysed reviews and processes them through the AI NLP worker in batches.

---

## 5. Executive Reports Endpoints

### `GET /api/reports/weekly`
Returns structured executive briefing for the current week.

### `POST /api/reports/weekly/generate`
Generates and archives an immutable weekly snapshot into `scheduled_jobs`.
