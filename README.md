# AZZURRO INSIGHTS — Multi-Property Hotel Review Intelligence Platform

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Python](https://img.shields.io/badge/Python-3.11%2B-yellow.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%20(Supabase)-336791.svg)
![Tests](https://img.shields.io/badge/Tests-94%20Passing-brightgreen.svg)
![License](https://img.shields.io/badge/License-Proprietary-red.svg)

An enterprise-grade, locally executable guest intelligence and automated review ingestion platform engineered for **Azzurro Hotels Sydney** (`OLYMPIC-PADDINGTON`, `POTTS-POINT`, `CENTRAL-SYDNEY`, `DARLING-HARBOUR`).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Problem](#2-business-problem)
3. [Main Features](#3-main-features)
4. [Technology Stack](#4-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Database Relationship Diagram](#6-database-relationship-diagram)
7. [Review Collection Methodology](#7-review-collection-methodology)
8. [Authorized Data Access Assumptions](#8-authorized-data-access-assumptions)
9. [CSV and JSON Import Instructions](#9-csv-and-json-import-instructions)
10. [AI Methodology](#10-ai-methodology)
11. [Sentiment Classification](#11-sentiment-classification)
12. [Topic Classification](#12-topic-classification)
13. [Analytics Methodology](#13-analytics-methodology)
14. [Database Setup](#14-database-setup)
15. [Supabase Configuration](#15-supabase-configuration)
16. [Python Worker Setup](#16-python-worker-setup)
17. [Frontend Setup](#17-frontend-setup)
18. [Backend Setup](#18-backend-setup)
19. [Environment Variables](#19-environment-variables)
20. [Running Scheduled Jobs](#20-running-scheduled-jobs)
21. [Testing Instructions](#21-testing-instructions)
22. [Known Limitations](#22-known-limitations)
23. [Future Improvements](#23-future-improvements)

---

## 1. Project Overview

**AZZURRO INSIGHTS** is a centralized review collection, natural language processing, and executive analytics platform built for the boutique property portfolio of Azzurro Hotels Sydney:
* **Olympic Hotel Paddington** (`OLYMPIC-PADDINGTON`) — Historic boutique hotel in Paddington.
* **Venus Potts Point Sydney** (`POTTS-POINT`) — Art deco property in vibrant Potts Point.
* **Venus Central Sydney** (`CENTRAL-SYDNEY`) — Heritage property near Central Station / Surry Hills.
* **Château de Venus** (`DARLING-HARBOUR`) — Luxury waterfront hotel in Darling Harbour.

The system ingests guest reviews from authorized channels, detects duplicates using cryptographic SHA-256 fingerprinting, classifies feedback into 16 operational topics with local open-source NLP models, calculates weekly executive KPIs in the `Australia/Sydney` timezone, and surfaces actionable diagnostic insights with direct review evidence.

---

## 2. Business Problem

Hoteliers operating multi-property boutique portfolios face severe operational blind spots:
1. **Scattered Feedback:** Reviews arrive across multiple channels with inconsistent schemas and rating formats.
2. **Deceptive Star Ratings:** A high numerical score (e.g. 8/10) often conceals urgent maintenance or cleanliness issues; conversely, a low rating may stem from isolated issues while praising the staff.
3. **Manual Analysis Fatigue:** Reading hundreds of unstructured text reviews leads to subjective interpretations, delayed maintenance responses, and recurring guest complaints.
4. **Third-Party API Dependency & Cost:** Relying on paid cloud LLMs (OpenAI, Claude) introduces high per-token operating costs, network latency, and privacy compliance risks with customer feedback.

AZZURRO INSIGHTS eliminates these challenges through an automated, on-premise/self-hosted AI architecture that continuously extracts structured operational metrics from unstructured text.

---

## 3. Main Features

* **Multi-Property Executive Dashboard:** Weekly average ratings, previous-week comparison diffs, rating trends, and sentiment distribution across the portfolio and individual hotels.
* **Dual Ingestion Engine (CSV & JSON):** Drag-and-drop CSV importer with flexible header alias auto-detection, schema normalization, preview modal, and failed-row reporting.
* **Cryptographic Deduplication:** Idempotent SHA-256 fingerprinting that prevents duplicate entries even across repeated imports or failed retries.
* **Local Hybrid NLP Worker:** Zero mandatory paid APIs. Runs open-source VADER and transformer models locally for sentiment and multi-label topic classification at sub-10ms latency.
* **16 Operational Topic Dimensions:** Real-time tracking of Cleanliness, Staff Behaviour, Receptionist Behaviour, Noise, Facilities, Location, Wi-Fi, Food/Breakfast, Maintenance, and more.
* **Contrastive Clause Resolution:** Accurately classifies mixed reviews containing opposing sentiments (*"Magnificent location, but the shower was freezing"*).
* **Actionable Operational Insights:** Data-driven operational recommendations ranked by critical priority scores, each backed by verified review evidence and direct guest quotes.
* **Automated Background Scheduler:** `node-cron` orchestrator aligned with `Australia/Sydney` timezone for daily multi-property ingestion, weekly reporting snapshots, and background AI queue workers.
* **Audit Trail & Non-Destructive Corrections:** Human-in-the-loop review corrections stored in audit logs without mutating immutable original AI classifications.

---

## 4. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 7.3, Tailwind CSS | Luxury Azzurro slate/navy palette, responsive desktop & tablet layout |
| **Data Visualization** | Recharts, Lucide React | Time-series daily trendlines, sentiment distribution, operational priority charts |
| **State & Cache** | TanStack React Query 5 | Automatic cache invalidation, background refetching, query deduplication |
| **Backend API** | Node.js 20+, Express.js 4.19 | Modular REST API (`/api/v1` and `/api`), Helmet security, rate limiting |
| **Database Pool** | `pg.Pool` / PostgreSQL 15 | Direct connection pooling with automated Supabase client fallback |
| **Database Host** | Supabase PostgreSQL | Fully normalized relational schema, check constraints, foreign keys |
| **AI NLP Worker** | Python 3.11+, FastAPI, Uvicorn | Local hybrid inference (VADER, CardiffNLP Twitter-RoBERTa, rule-based keywords) |
| **Job Scheduling** | `node-cron` | Timezone-aware (`Australia/Sydney`) automated recurring workflows |
| **Testing Engine** | Vitest 3.2, Pytest 8.3, `pg-mem` | 94 automated test cases covering end-to-end integration, UI, and NLP logic |

---

## 5. System Architecture

```mermaid
flowchart TD
    subgraph UI ["Frontend Client (React 18 + Vite) :5173"]
        Dash["Overview & Analytics Pages"]
        Explorer["Reviews Explorer & Filters"]
        ImportUI["Data Import & Preview Modal"]
        Monitor["Collection Monitor & Cron Management"]
    end

    subgraph API ["Backend API Tier (Express.js) :3001"]
        Endpoints["REST API Endpoints (/api & /api/v1)"]
        CronSched["node-cron Scheduler (Australia/Sydney)"]
        JobLock["Atomic JobLock Concurrency Guard"]
        IngestionSvc["Ingestion & Deduplication Engine"]
        AnalyticsEngine["Analytics & Priority Scoring Engine"]
    end

    subgraph NLP ["Local AI Worker (FastAPI) :8001"]
        SentimentPipeline["Sentiment Pipeline (VADER + RoBERTa)"]
        TopicTaxonomy["16-Topic Multi-Label Engine"]
        LangDetector["Language Detection Engine"]
    end

    subgraph DB ["Database Tier (Supabase PostgreSQL 15) :5432"]
        MasterTables["8 Normalized Relational Tables"]
        Constraints["Score Constraints (0-10) & Foreign Keys"]
        UniqueIndexes["SHA-256 Fingerprint Uniqueness"]
    end

    UI -->|"HTTP/JSON"| Endpoints
    CronSched --> JobLock --> IngestionSvc
    Endpoints --> IngestionSvc
    Endpoints --> AnalyticsEngine
    IngestionSvc -->|"X-Service-Secret"| NLP
    IngestionSvc -->|"Direct pg.Pool"| DB
    AnalyticsEngine -->|"Direct pg.Pool"| DB
```

---

## 6. Database Relationship Diagram

```mermaid
erDiagram
    PROPERTIES ||--o{ REVIEWS : "has"
    PROPERTIES ||--o{ COLLECTION_LOGS : "monitors"
    PROPERTIES ||--o{ COLLECTION_BATCHES : "receives"
    
    COLLECTION_BATCHES ||--o{ REVIEWS : "groups"
    COLLECTION_BATCHES ||--o{ COLLECTION_LOGS : "logs"
    
    REVIEWS ||--o{ REVIEW_ANALYSES : "analyzed"
    REVIEWS ||--o{ REVIEW_TOPICS : "classified"
    REVIEWS ||--o{ MANUAL_CORRECTIONS : "audited"
    
    SCHEDULED_JOBS ||--o{ COLLECTION_LOGS : "records"
```

The database consists of **8 core tables**:
1. `properties` — Hotel portfolio master records (`property_code`, `name`, `location`, `timezone`).
2. `reviews` — Normalized guest feedback records with SHA-256 fingerprints.
3. `review_analyses` — AI sentiment classification results and model metadata.
4. `review_topics` — Multi-label operational topics with topic-specific positive/negative polarities.
5. `collection_batches` — Ingested file batch tracking and byte totals.
6. `collection_logs` — Execution audit log with processed, inserted, duplicate, and rejected counts.
7. `manual_corrections` — Non-destructive human audit trail.
8. `scheduled_jobs` — node-cron task registry and execution history.

---

## 7. Review Collection Methodology

AZZURRO INSIGHTS implements a modular adapter architecture (`server/src/modules/collection/collectionAdapter.js`):
1. **CSV Upload Adapter (`csv_upload`):** Ingests hotel spreadsheet exports with header detection.
2. **JSON Payload Adapter (`json_import`):** Ingests structured JSON review feeds directly via API.
3. **Synthetic Data Generator (`synthetic_generator`):** Built-in demo engine generating realistic guest reviews across all 4 properties with explicit synthetic provenance flags.
4. **Playwright Crawler (`playwright_authorized`):** Optional browser automation adapter. **Strictly disabled** by default unless written legal authorization is verified.

---

## 8. Authorized Data Access Assumptions

* **Booking.com Terms of Service Compliance:** Automated scraping of Booking.com without authorization is strictly prohibited under Booking.com Terms of Service (Section 7.3). AZZURRO INSIGHTS does **not** perform unauthorized web crawling.
* **Production Ingestion Assumption:** In a production hotel operating environment, review data is collected via:
  - Official Booking.com Partner / Connectivity APIs.
  - Authorized PMS review exports uploaded via CSV/JSON.
  - Guest feedback forms and direct hotel surveys.
* **Synthetic Test Data:** For demonstration and testing purposes, the repository provides 220 fully synthetic, pre-annotated sample reviews clearly marked with `"synthetic": true`.

---

## 9. CSV and JSON Import Instructions

Sample files are located in `data/samples/`:
* `data/samples/synthetic_reviews_220.csv`
* `data/samples/synthetic_reviews_220.json`

### Option A: Via Web Dashboard
1. Open the web interface at `http://localhost:5173`.
2. Navigate to **Data Import** in the left sidebar.
3. Drag and drop `synthetic_reviews_220.csv` or select a file.
4. The system previews column mapping and row counts automatically.
5. Click **Confirm & Import Reviews**. The system inserts unique records, rejects duplicates, and runs AI classification.

### Option B: Via cURL (CSV Upload)
```bash
curl -X POST http://localhost:3001/api/reviews/import/csv \
  -F "file=@data/samples/synthetic_reviews_220.csv"
```

### Option C: Via cURL (JSON Ingestion)
```bash
curl -X POST http://localhost:3001/api/reviews/import/json \
  -H "Content-Type: application/json" \
  -d '{"reviews": [{"property": "OLYMPIC-PADDINGTON", "rating": 9.5, "review_date": "2026-11-18", "positive_text": "Great stay!"}]}'
```

---

## 10. AI Methodology

The NLP analysis microservice (`ai-worker/`) is engineered specifically for hospitality operational diagnostics:
* **Cost:** $0.00 operational API costs (100% locally executed).
* **Speed:** 2 to 10 ms inference latency per review.
* **Privacy:** All guest comments remain strictly on-premise without third-party LLM data sharing.

---

## 11. Sentiment Classification

Reviews are classified into four mutually exclusive categories:
* **Positive:** Semantic polarity score $\ge +0.05$ with complimentary phrasing.
* **Negative:** Semantic polarity score $\le -0.05$ with critical operational feedback.
* **Neutral:** Factual, inquiry-based, or non-evaluative comments.
* **Mixed:** Reviews containing distinct opposing sentiments across different operational areas (e.g. praising the location while condemning the room cleanliness).

The hotel numerical rating (0–10) is **never** blindly mapped to sentiment. A 7.5/10 review stating *"The room was dirty and the shower leaked, but the receptionist was lovely"* is correctly diagnosed as **Mixed**.

---

## 12. Topic Classification

The engine monitors **16 standardized operational topics**:
1. Cleanliness
2. Check-in Experience
3. Staff Behaviour
4. Receptionist Behaviour
5. Noise
6. Facilities
7. Location
8. Room Condition
9. Value for Money
10. Bathroom
11. Bed Comfort
12. Wi-Fi
13. Food and Breakfast
14. Safety
15. Maintenance
16. Other

A review can have multiple topics assigned simultaneously, each with an independent polarity (`positive`, `negative`, `neutral`).

---

## 13. Analytics Methodology

* **Reporting Timezone:** `Australia/Sydney` (AEST UTC+10 / AEDT UTC+11).
* **Week Definition:** Monday 00:00:00 to Sunday 23:59:59.
* **Equivalent Elapsed Comparison:** To ensure accurate mid-week reporting, the previous-week comparison evaluates the equivalent elapsed elapsed period (e.g., Monday through Wednesday of this week compared to Monday through Wednesday of last week).
* **Operational Priority Score:** Calculated as:
  $$\text{Priority Score} = (\text{Complaint Count} \times 0.6) + ((10 - \text{Topic Avg Rating}) \times 4.0)$$
  Categorized into **Critical**, **High**, **Medium**, and **Low** urgency levels.

---

## 14. Database Setup

1. Open your **Supabase Dashboard** or local PostgreSQL terminal.
2. Navigate to the **SQL Editor**.
3. Run the migrations sequentially from the `database/migrations/` directory:
   - `001_initial_schema.sql` (Creates 8 tables, constraints, foreign keys, and indexes)
   - `002_seed_properties.sql` (Seeds 4 Azzurro Hotels Sydney properties)
   - `003_seed_demo_reviews.sql` (Optional: Seeds 220 pre-analyzed demo reviews)
   - `004_seed_scheduled_jobs.sql` (Seeds background cron task entries)

---

## 15. Supabase Configuration

Configure your `server/.env` file with your Supabase credentials:
```bash
# Supabase Project URL (Public)
SUPABASE_URL=https://your-project-ref.supabase.co

# Anon Public Key
SUPABASE_ANON_KEY=your-anon-public-key-here

# Service Role Key (Privileged — NEVER expose in frontend or git)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Direct PostgreSQL Connection URI (Supabase -> Settings -> Database -> Connection string URI)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres
```

---

## 16. Python Worker Setup

The AI worker runs with Python 3.11 or higher:

```bash
cd azzurro-insights/ai-worker

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env

# Start FastAPI worker on port 8001
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 17. Frontend Setup

```bash
cd azzurro-insights/client

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start Vite development server on port 5173
npm run dev
```

---

## 18. Backend Setup

```bash
cd azzurro-insights/server

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start Express backend on port 3001
npm run dev
```

---

## 19. Environment Variables

See the root template at [.env.example](file:///Users/rohitkumar/Desktop/azzuro/azzurro-insights/.env.example) for a consolidated overview.

### Server (`server/.env`)
* `PORT`: Server port (default: `3001`)
* `NODE_ENV`: `development` | `test` | `production`
* `CORS_ORIGIN`: Allowed origins (e.g. `http://localhost:5173`)
* `TIMEZONE`: Reporting timezone (`Australia/Sydney`)
* `DATABASE_URL`: PostgreSQL connection string URI
* `AI_SERVICE_URL`: AI microservice URL (`http://localhost:8001`)
* `AI_SERVICE_SECRET`: Shared internal security token
* `PLAYWRIGHT_ENABLED`: Keep `false`

### Client (`client/.env`)
* `VITE_API_BASE_URL`: Express API URL (`http://localhost:3001/api/v1`)
* `VITE_SUPABASE_URL`: Supabase project URL
* `VITE_SUPABASE_ANON_KEY`: Public anonymous key only

### AI Worker (`ai-worker/.env`)
* `PORT`: AI service port (default: `8001`)
* `HOST`: Bind host (`0.0.0.0`)
* `AI_SERVICE_SECRET`: Must match `server/.env`

---

## 20. Running Scheduled Jobs

Automated background jobs are managed via `node-cron` in [scheduler.js](file:///Users/rohitkumar/Desktop/azzuro/azzurro-insights/server/src/modules/automation/scheduler.js):
* **Daily Multi-Property Ingestion:** `0 2 * * *` (02:00 AM Sydney AEST)
* **Weekly Analytics Snapshot:** `0 3 * * 1` (03:00 AM Monday Sydney AEST)
* **AI Queue Background Worker:** `*/30 * * * *` (Every 30 minutes)
* **Per-Property Tasks:** Offset at 10-minute intervals to avoid resource contention.

### Managing Jobs via UI
Open the dashboard and navigate to **Collection Monitor**:
* View registered jobs, cron schedules, lock states, and failure counts.
* Click **Run Now** to trigger an on-demand run.
* Click the toggle button to pause or resume any scheduled job.

---

## 21. Testing Instructions

The repository includes a complete test harness with **94 automated tests**:

```bash
# 1. Run Server Tests (72 tests covering Express, Database, Deduplication, Scheduler)
npm test --prefix azzurro-insights/server

# 2. Run Frontend Tests (13 tests covering React Router, Layout, TopNav, all 8 pages)
npm test --prefix azzurro-insights/client

# 3. Run AI Worker Tests (9 tests covering Sentiment, 16 Topics, Negation, Multilingual)
cd azzurro-insights/ai-worker && ./venv/bin/python -m pytest tests/ -v

# 4. Run Client Production Build (Verify zero bundling or compilation errors)
npm run build --prefix azzurro-insights/client
```

---

## 22. Known Limitations

1. **Direct Web Scraping Air-Gapped:** In accordance with Booking.com Terms of Service (Section 7.3), automated scraping is disabled. Ingestion relies on CSV/JSON exports or authorized API feeds.
2. **In-Memory SQLite/pg-mem in Tests:** In-memory integration tests run under `pg-mem`, which requires custom SQL function registrations for PostgreSQL-specific native procedures.
3. **Local NLP Model Scope:** The local hybrid NLP worker is tuned for English, Italian, German, and Spanish. Asian languages (e.g. Chinese, Japanese) require loading specialized Hugging Face tokenizers.

---

## 23. Future Improvements

1. **Official Booking.com Connectivity Partner API Integration:** Direct OAuth2 partner integration for zero-touch real-time review webhooks.
2. **Automated AI Response Drafting:** Generative AI assistant suggesting personalized, brand-compliant management responses to negative guest reviews.
3. **Predictive Churn & Reputation Alerts:** Machine learning alerts predicting hotel review score shifts before they impact online OTA rankings.
4. **Competitor Benchmarking:** Tracking neighboring Sydney boutique properties to calculate relative RevPAR and satisfaction premiums.

---

## 24. License & Submission

Developed for **Azzurro Hotels Sydney**. All proprietary rights reserved.
