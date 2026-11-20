# Placeholder README for database migrations
# Full schema applied in Phase 3.

## Running Migrations

Migrations are SQL files in this directory, numbered sequentially:

  001_initial_schema.sql  — Phase 3
  002_seed_properties.sql — Phase 3

Apply via Supabase SQL editor or the Supabase CLI:

  supabase db push

Or directly via psql:

  psql $DATABASE_URL -f migrations/001_initial_schema.sql

