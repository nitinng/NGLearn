-- ================================================================
-- 3/3  Row Level Security hardening for the whole public schema.
--
-- Turns RLS on for every table in `public` (an earlier script turned it off
-- for the contest tables). Tables keep whatever policies they already have;
-- a table with RLS on and no policies is readable only by the service role,
-- which is what the server-side code uses.
--
-- After running, check the result with the query at the bottom.
-- ================================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Nothing in this app should be reachable with the public anon key: every
-- read and write happens server-side after the user signs in.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Review: every public table, whether RLS is on, and how many policies it has.
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
--        (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
-- ORDER BY 1;
