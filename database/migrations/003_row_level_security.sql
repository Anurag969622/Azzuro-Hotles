-- ==============================================================================
-- Migration: 003_row_level_security.sql
-- Project: AZZURRO INSIGHTS
-- Description: Comprehensive Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. Enable RLS on all operational and analytics tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- 2. Privileged Service Role Bypass (Backend Operations)
-- Note: In Supabase, the 'service_role' key automatically bypasses RLS,
-- but we make explicit policies for postgres/service_role roles.
CREATE POLICY "service_role_all_properties" ON properties
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_batches" ON collection_batches
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_reviews" ON reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_analyses" ON review_analyses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_topics" ON review_topics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_logs" ON collection_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_corrections" ON manual_corrections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_jobs" ON scheduled_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Anonymous / Public Users:
-- Strictly NO direct insert, update, or delete.
-- Read access to active properties and reviews can be granted only for dashboard reads if needed.
CREATE POLICY "anon_read_active_properties" ON properties
    FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "anon_read_reviews" ON reviews
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_analyses" ON review_analyses
    FOR SELECT TO anon USING (analysis_status = 'completed');

CREATE POLICY "anon_read_topics" ON review_topics
    FOR SELECT TO anon USING (true);

-- 4. Authenticated Roles (For future hotel manager / admin authentication)
-- Hotel Managers (read-only):
CREATE POLICY "authenticated_read_all" ON reviews
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_analyses" ON review_analyses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_topics" ON review_topics
    FOR SELECT TO authenticated USING (true);

-- Authorized Admins (Insert / Correct):
CREATE POLICY "admin_insert_corrections" ON manual_corrections
    FOR INSERT TO authenticated 
    WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "admin_read_logs" ON collection_logs
    FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

