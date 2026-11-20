# AZZURRO INSIGHTS — Testing Strategy & Verification Guide

## 1. Multi-Tier Testing Philosophy

AZZURRO INSIGHTS employs a zero-mock database approach for server integration testing using `pg-mem`, combined with isolated unit suites, client DOM verification, and Python model evaluation.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                94 Automated Test Cases                      │
       ├──────────────────────────────┬──────────────────────────────┤
       │ 72 Server Tests (Vitest)     │ • 16 E2E integration tests   │
       │                              │ • Database migrations & DDL  │
       │                              │ • Deduplication & parsers    │
       │                              │ • node-cron & job locks      │
       ├──────────────────────────────┼──────────────────────────────┤
       │ 13 Frontend Tests (Vitest)   │ • Layout & TopNav Sydney TZ  │
       │                              │ • All 8 primary pages        │
       │                              │ • System status diagnostics  │
       ├──────────────────────────────┼──────────────────────────────┤
       │ 9 AI Worker Tests (Pytest)   │ • Sentiment & 16-topic logic │
       │                              │ • Negation & contrast clauses│
       │                              │ • Multilingual & health pings│
       └──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Test Execution Commands

### 2.1 Server Backend Test Suites (72 Tests)
```bash
# Run all server unit and integration tests
npm test --prefix azzurro-insights/server

# Run verbose mode
cd azzurro-insights/server && npx vitest run --reporter=verbose

# Run specific E2E workflow integration suite
cd azzurro-insights/server && npx vitest run tests/integration/phase9FullEndToEnd.test.js
```

### 2.2 Client Frontend UI Test Suites (13 Tests)
```bash
# Run all frontend component and routing tests
npm test --prefix azzurro-insights/client

# Run verbose mode
cd azzurro-insights/client && npx vitest run --reporter=verbose
```

### 2.3 AI Worker NLP Test Suites (9 Tests)
```bash
# Run Python FastAPI model and health tests
cd azzurro-insights/ai-worker && ./venv/bin/python -m pytest tests/ -v
```

### 2.4 Client Production Build
```bash
# Verify Vite bundling and TypeScript/JSX compilation
npm run build --prefix azzurro-insights/client
```

---

## 3. Test Suites Matrix

### Backend Unit & Integration Tests (`server/tests/`)
1. **`phase9FullEndToEnd.test.js` (16 tests):** Complete lifecycle test verifying cold boot, empty database states, multi-property JSON ingestion, repeated CSV/JSON deduplication, invalid rating format rejection, missing text validation, mixed sentiment with opposing operational topics, Italian language detection, weekly average analytics, rating band filters, pagination, executive weekly reports, scheduler status, and non-destructive manual audit trails.
2. **`schedulerAndAutomation.test.js` (9 tests):** Validates atomic `JobLock` acquisition, overlapping task exclusion, automatic lock timeout expiration, multi-property isolation where failures on one hotel do not impact the remaining three, exponential retry backoff, and graceful cron shutdown.
3. **`databaseSchema.test.js` (6 tests):** Validates DDL migrations, check constraints (`rating >= 0 AND rating <= 10`), foreign key cascades, and unique indexes on fingerprints.
4. **`ingestionPartialFailures.test.js` (2 tests):** Confirms that malformed rows or unrecognized property codes do not abort ingestion of valid rows in the same batch.
5. **`ingestion.test.js` (8 tests):** Validates flexible CSV header detection, date normalisation, and SHA-256 fingerprint generation.
6. **`analysisService.test.js` (7 tests):** Tests the internal Node-to-Python client, payload formatting, and secret token authentication.
7. **`analyticsCalculations.test.js` (4 tests):** Validates Australia/Sydney Monday-aligned weekly aggregation math and diffs.
8. **`backendEndpoints.test.js` (12 tests):** Validates Express HTTP route status codes and JSON response schemas.
9. **`health.test.js` (3 tests):** Validates health and readiness endpoints.
10. **`errorHandler.test.js` (2 tests):** Validates custom `AppError` operational error formatting.
11. **`importApi.test.js` (5 tests):** Validates file upload middleware and preview handlers.

### Frontend Component Tests (`client/src/tests/`)
1. **`Phase7Navigation.test.jsx` (9 tests):** Validates the responsive dark sidebar navigation (Overview, Properties, Reviews Explorer, AI Insights, Collection Monitor, Data Import, Settings), top navigation bar with property selection and Australia/Sydney timezone indicator, executive KPI cards, charts, reviews explorer with filters, operational topic diagnostics, collection monitor adapter states, and data import dropzone.
2. **`SystemStatusPage.test.jsx` (4 tests):** Validates system diagnostic checks, service indicators, and connectivity error fallbacks.

### AI Worker NLP Tests (`ai-worker/tests/`)
1. **`test_analysis.py` (6 tests):** Validates sentiment classification accuracy, 16-topic multi-label assignment, negation handling, multilingual review classification, empty string resilience, and batch API endpoints.
2. **`test_health.py` (3 tests):** Validates `/health`, `/ping`, and service information endpoints.
