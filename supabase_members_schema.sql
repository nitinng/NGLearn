-- ================================================================
-- NG MEMBERS SCHEMA
-- Unified member list replacing per-contest user_list_members
-- ================================================================

-- ================================================================
-- TABLE: ng_members
-- Unified list of NG members with team/group metadata
-- ================================================================
CREATE TABLE IF NOT EXISTS ng_members (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  alt_email   TEXT,           -- Alternate email for Coursera tracking
  full_name   TEXT NOT NULL,
  team        TEXT,           -- e.g. "CEO's Office", "Alumni Network", "Pay-Forward"
  group_name  TEXT,           -- e.g. cohort or batch grouping
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ng_members_email ON ng_members (email);
CREATE INDEX IF NOT EXISTS idx_ng_members_team  ON ng_members (team);

-- ================================================================
-- TABLE: ng_members_import_log
-- Audit trail for every member list upload
-- ================================================================
CREATE TABLE IF NOT EXISTS ng_members_import_log (
  id              BIGSERIAL PRIMARY KEY,
  filename        TEXT,
  rows_imported   INTEGER,
  rows_skipped    INTEGER,
  action          TEXT NOT NULL DEFAULT 'import',  -- 'import' | 'clear'
  status          TEXT NOT NULL DEFAULT 'success', -- 'success' | 'error'
  error_message   TEXT,
  duration_ms     INTEGER,
  imported_by     TEXT,
  imported_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- RLS Policies for ng_members
-- ================================================================
ALTER TABLE ng_members ENABLE ROW LEVEL SECURITY;

-- Only service role (admin client) can insert/update/delete
CREATE POLICY "Admin full access to ng_members"
  ON ng_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read members
CREATE POLICY "Authenticated users can read ng_members"
  ON ng_members
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ================================================================
-- RLS Policies for ng_members_import_log
-- ================================================================
ALTER TABLE ng_members_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to ng_members_import_log"
  ON ng_members_import_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read ng_members_import_log"
  ON ng_members_import_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ================================================================
-- Add start_date / end_date to contest_series (if not already present)
-- ================================================================
ALTER TABLE contest_series
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

-- ================================================================
-- MIGRATION: Add import_type to contest_coursera_import_log
-- (Run this if you already have the table from supabase_contest_schema.sql)
-- ================================================================
ALTER TABLE contest_coursera_import_log
  ADD COLUMN IF NOT EXISTS import_type TEXT; -- 'contest_start' | 'contest_end'

-- ================================================================
-- Helper function: get the global snapshot month closest to a date
-- Used for delta computation for contests
-- ================================================================
CREATE OR REPLACE FUNCTION get_baseline_snapshot_month(p_target_date DATE)
RETURNS TEXT AS $$
DECLARE
  v_month TEXT;
BEGIN
  SELECT snapshot_month
  INTO v_month
  FROM coursera_import_log
  WHERE status = 'success'
    AND action = 'import'
    AND snapshot_month::DATE <= p_target_date
  ORDER BY snapshot_month::DATE DESC
  LIMIT 1;
  
  RETURN v_month;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- MIGRATION: Drop user_list_id from sub_contests
-- Participants are now sourced from ng_members globally.
-- contest_user_lists and contest_user_list_members tables are deprecated.
-- ================================================================
-- Safe to run — IF EXISTS prevents errors on fresh installs
ALTER TABLE sub_contests
  DROP COLUMN IF EXISTS user_list_id;

-- Optionally drop the now-unused tables (comment out if you want to keep historical data)
-- DROP TABLE IF EXISTS contest_user_list_members;
-- DROP TABLE IF EXISTS contest_user_lists;
