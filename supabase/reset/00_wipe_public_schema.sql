-- ================================================================
-- WIPE the NGLearn database: removes EVERY table, view, function,
-- type, sequence and trigger in the `public` schema, then recreates
-- an empty `public` schema with Supabase's standard grants.
--
-- Run in the Supabase SQL Editor of the NGLearn project ONLY.
-- Check the project name in the top bar before running.
--
-- NOT touched:
--   * auth.*     sign-in accounts and their roles (app_metadata.role)
--   * storage.*  uploaded files / buckets
--   * extensions schema
-- (Optional clean-up for those is at the bottom, commented out.)
--
-- THIS CANNOT BE UNDONE. Download a backup first
-- (Database → Backups, or `pg_dump`) if anything might be needed.
-- ================================================================

-- STEP 1 (optional): see what is about to be deleted. Run this alone first.
-- SELECT c.relkind, c.relname,
--        pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
--        c.reltuples::bigint AS approx_rows
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
-- ORDER BY pg_total_relation_size(c.oid) DESC;

-- STEP 2: wipe.
BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres;
COMMENT ON SCHEMA public IS 'standard public schema';

-- Schema access (same as a fresh Supabase project).
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;

-- New tables/functions: full access for the server (service_role).
-- anon/authenticated get nothing by default; NGLearn reads and writes
-- only from the server after checking the user's role. Grant per table
-- if a feature ever needs browser access, and pair it with RLS policies.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;

-- Make the API (PostgREST) forget the old tables immediately.
NOTIFY pgrst, 'reload schema';

-- STEP 3: confirm it is empty (should return 0 rows).
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- ----------------------------------------------------------------
-- OPTIONAL extra clean-up. Uncomment only if you really want it.
-- ----------------------------------------------------------------
-- Remove every sign-in account (everyone must log in again; roles are lost):
--   DELETE FROM auth.users;
-- Remove every uploaded file and bucket:
--   DELETE FROM storage.objects;
--   DELETE FROM storage.buckets;
