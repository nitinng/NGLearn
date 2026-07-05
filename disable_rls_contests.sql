-- ================================================================
-- DISABLE ROW LEVEL SECURITY (RLS) FOR CONTEST TABLES
-- Run this script in the Supabase SQL Editor to resolve RLS errors.
-- ================================================================

ALTER TABLE contest_series DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_user_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_user_list_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE sub_contests DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_coursera_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_coursera_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_coursera_learner_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_coursera_computed_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_coursera_import_log DISABLE ROW LEVEL SECURITY;
