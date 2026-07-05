-- ================================================================
-- CONTEST HIERARCHY & ANALYTICS SCHEMA
-- ================================================================

-- ================================================================
-- TABLE 1: contest_series
-- Parent container for contests. e.g. "Learn Along with Coursera"
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- TABLE 2: contest_user_lists
-- Reusable lists of participants for a contest.
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- TABLE 3: contest_user_list_members
-- The actual users inside a user list.
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_user_list_members (
  id BIGSERIAL PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES contest_user_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, email)
);

-- ================================================================
-- TABLE 4: sub_contests
-- Individual events. e.g. "Week 1 Contest"
-- ================================================================
CREATE TABLE IF NOT EXISTS sub_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES contest_series(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  user_list_id UUID REFERENCES contest_user_lists(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(series_id, name)
);

-- ================================================================
-- TABLE 5: contest_coursera_config
-- Single row. Controls thresholds used in metric computation.
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_coursera_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  minimum_monthly_hours NUMERIC  DEFAULT 20.0,
  inactive_after_days   INTEGER  DEFAULT 90,
  total_licenses        INTEGER  DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO contest_coursera_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ================================================================
-- TABLE 6: contest_coursera_snapshots
-- Raw import target. INSERT ONLY. 
-- One row per (sub_contest_id, email, course_id).
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_coursera_snapshots (
  id                        BIGSERIAL PRIMARY KEY,
  sub_contest_id            UUID         NOT NULL REFERENCES sub_contests(id) ON DELETE CASCADE,
  email                     TEXT         NOT NULL,
  name                      TEXT,
  course_id                 TEXT         NOT NULL,
  course_name               TEXT,
  course_slug               TEXT,
  university                TEXT,
  course_type               TEXT,
  program_name              TEXT,
  enrollment_time           TIMESTAMPTZ,
  last_activity_time        TIMESTAMPTZ,
  overall_progress          NUMERIC      NOT NULL DEFAULT 0,
  cumulative_learning_hours NUMERIC      NOT NULL DEFAULT 0,
  completed                 BOOLEAN      NOT NULL DEFAULT FALSE,
  removed_from_program      BOOLEAN      NOT NULL DEFAULT FALSE,
  completion_time           TIMESTAMPTZ,
  course_grade              NUMERIC,
  imported_at               TIMESTAMPTZ  DEFAULT NOW(),

  UNIQUE (sub_contest_id, email, course_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_snap_sub_contest  ON contest_coursera_snapshots (sub_contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_snap_email        ON contest_coursera_snapshots (email);

-- ================================================================
-- TABLE 7: contest_coursera_learner_stats
-- Pre-aggregated per learner for a specific sub_contest. 
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_coursera_learner_stats (
  id                   BIGSERIAL PRIMARY KEY,
  sub_contest_id       UUID    NOT NULL REFERENCES sub_contests(id) ON DELETE CASCADE,
  email                TEXT    NOT NULL,
  name                 TEXT,
  period_hours         NUMERIC NOT NULL DEFAULT 0,
  cumulative_hours     NUMERIC NOT NULL DEFAULT 0,
  courses_enrolled     INTEGER          DEFAULT 0,
  courses_active       INTEGER          DEFAULT 0,
  courses_completed    INTEGER          DEFAULT 0,
  new_completions      INTEGER          DEFAULT 0,
  avg_progress         NUMERIC          DEFAULT 0,
  is_active            BOOLEAN          DEFAULT FALSE,
  is_compliant         BOOLEAN          DEFAULT FALSE,
  days_since_activity  INTEGER,

  UNIQUE (sub_contest_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contest_ls_sub_contest ON contest_coursera_learner_stats (sub_contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_ls_email ON contest_coursera_learner_stats (email);

-- ================================================================
-- TABLE 8: contest_coursera_computed_metrics
-- One JSONB blob per sub_contest. This is ALL the dashboard reads.
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_coursera_computed_metrics (
  id             BIGSERIAL PRIMARY KEY,
  sub_contest_id UUID    NOT NULL REFERENCES sub_contests(id) ON DELETE CASCADE UNIQUE,
  metrics        JSONB   NOT NULL,
  generated_at   TIMESTAMPTZ DEFAULT NOW(),
  generated_by   TEXT
);

-- ================================================================
-- TABLE 9: contest_coursera_import_log
-- Audit trail for every upload and rollback, tied to sub_contest.
-- ================================================================
CREATE TABLE IF NOT EXISTS contest_coursera_import_log (
  id                BIGSERIAL PRIMARY KEY,
  sub_contest_id    UUID    NOT NULL REFERENCES sub_contests(id) ON DELETE CASCADE,
  filename          TEXT,
  file_size_bytes   INTEGER,
  rows_imported     INTEGER,
  learners_affected INTEGER,
  action            TEXT    NOT NULL DEFAULT 'import',  -- 'import' | 'rollback' | 'recalculate'
  status            TEXT    NOT NULL DEFAULT 'success', -- 'success' | 'error' | 'pending'
  error_message     TEXT,
  duration_ms       INTEGER,
  imported_by       TEXT,
  imported_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We also need to recreate the RPC for getting previous period learner totals for the contest
-- Drop it if it exists
DROP FUNCTION IF EXISTS get_contest_prev_period_learner_totals;

CREATE OR REPLACE FUNCTION get_contest_prev_period_learner_totals(p_sub_contest_id UUID)
RETURNS TABLE (email TEXT, prev_hours NUMERIC) AS $$
BEGIN
  -- Logic to get baseline hours for a sub_contest. 
  -- If you need to find the "previous" sub_contest, you would query based on end_date.
  -- For now, returning cumulative hours from the same sub_contest if needed, 
  -- though this logic will need tweaking based on exact baseline requirements.
  RETURN QUERY
  SELECT l.email, l.cumulative_hours
  FROM contest_coursera_learner_stats l
  WHERE l.sub_contest_id = p_sub_contest_id;
END;
$$ LANGUAGE plpgsql;
