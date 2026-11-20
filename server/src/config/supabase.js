'use strict';

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = require('./env');

let supabaseAdmin = null;
let supabasePublic = null;

/**
 * Returns the privileged Supabase client (service-role key).
 * MUST only be used server-side. Never expose in frontend.
 */
function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null; // DB not configured yet — allowed in Phase 2
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

/**
 * Returns the public Supabase client (anon key — respects RLS).
 */
function getPublicClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  if (!supabasePublic) {
    supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabasePublic;
}

module.exports = { getAdminClient, getPublicClient };

