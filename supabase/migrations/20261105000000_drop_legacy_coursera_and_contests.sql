-- ================================================================
-- 1/3  Drop the legacy monthly Coursera + Contest modules.
--
-- Agreed with the team: the monthly and contest data is no longer needed,
-- and Zuvy starts fresh on the cohort/weekly-snapshot model.
-- Safe to run on a brand-new project (everything is IF EXISTS).
-- THIS DELETES DATA. Take a backup first if you are unsure.
-- ================================================================

-- Contests
DROP TABLE IF EXISTS public.contest_coursera_import_log      CASCADE;
DROP TABLE IF EXISTS public.contest_coursera_computed_metrics CASCADE;
DROP TABLE IF EXISTS public.contest_coursera_learner_stats   CASCADE;
DROP TABLE IF EXISTS public.contest_coursera_snapshots       CASCADE;
DROP TABLE IF EXISTS public.contest_coursera_config          CASCADE;
DROP TABLE IF EXISTS public.sub_contests                     CASCADE;
DROP TABLE IF EXISTS public.contest_user_list_members        CASCADE;
DROP TABLE IF EXISTS public.contest_user_lists               CASCADE;
DROP TABLE IF EXISTS public.contest_series                   CASCADE;
DROP TABLE IF EXISTS public.published_reports                CASCADE;

-- Monthly Coursera
DROP TABLE IF EXISTS public.coursera_import_log        CASCADE;
DROP TABLE IF EXISTS public.coursera_computed_metrics  CASCADE;
DROP TABLE IF EXISTS public.coursera_learner_month     CASCADE;
DROP TABLE IF EXISTS public.coursera_learner_stats     CASCADE;
DROP TABLE IF EXISTS public.coursera_snapshots         CASCADE;
DROP TABLE IF EXISTS public.coursera_config            CASCADE;

-- Global member list (replaced by per-cohort member lists)
DROP TABLE IF EXISTS public.ng_members_import_log CASCADE;
DROP TABLE IF EXISTS public.ng_members            CASCADE;

-- Helper functions that only served the above
DROP FUNCTION IF EXISTS public.get_contest_prev_period_learner_totals(uuid);
DROP FUNCTION IF EXISTS public.get_baseline_snapshot_month(date);
DROP FUNCTION IF EXISTS public.count_distinct_learners CASCADE;
