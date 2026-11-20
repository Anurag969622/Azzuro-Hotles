# AZZURRO INSIGHTS — Supabase Setup Guide

This guide explains how to connect your Supabase PostgreSQL project to AZZURRO INSIGHTS.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and log in or create an account.
2. Click **"New project"**.
3. Choose an organisation, assign a name (e.g. `azzurro-insights`), set a secure database password, and select a region close to your users (e.g. `Sydney (ap-southeast-2)`).
4. Wait for the project database to finish provisioning.

---

## 2. Retrieve Your Project Credentials

From your Supabase Project Dashboard:

### A. API Keys
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the following values:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Project API keys → `anon` `public`**: This is your `SUPABASE_ANON_KEY`.
   - **Project API keys → `service_role` `secret`**: This is your `SUPABASE_SERVICE_ROLE_KEY`.

> [!CAUTION]
> The `service_role` key has full administrative access and bypasses Row Level Security (RLS).
> **Never** expose it in frontend code, client builds, or commit it to Git. It belongs strictly in `server/.env`.

### B. Direct PostgreSQL Connection String
1. Go to **Project Settings** → **Database** → **Connection String**.
2. Select **URI**.
3. Copy the URI and replace `[YOUR-PASSWORD]` with your database password:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres
   ```

---

## 3. Configure Local Environment Variables

### In `server/.env`:
```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
DATABASE_URL=postgresql://postgres:<your-password>@db.<project-ref>.supabase.co:5432/postgres
```

### In `client/.env`:
```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```
*(Notice: The client only receives the `anon` key, never the `service_role` key).*

---

## 4. Verification

After updating your `.env` files, run the health check script:

```bash
npm run health
```

Or query the backend health endpoint:
```bash
curl http://localhost:3001/api/v1/health
```

The database check will report:
- `status: "ok"` or `"DB reachable — schema not yet applied (Phase 3)"` once Supabase credentials are wired.

