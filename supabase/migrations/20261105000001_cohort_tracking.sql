-- ================================================================
-- 2/3  Cohort tracking (Zuvy, MSDF, ...)
--
-- Model:
--   * A program (e.g. "Zuvy") uploads its FULL Coursera "Learner Activity"
--     export roughly once a week -> one row in cohort_snapshots plus one row
--     per (learner, course) in cohort_snapshot_rows.
--   * A cohort is just a named list of emails inside a program.
--   * Reports filter the full snapshot down to the cohort's emails and
--     compare two snapshot dates. Coursera hours are cumulative, so
--     hours learned = later snapshot - earlier snapshot (per course, floored at 0).
--
-- All access goes through the Next.js server (service role) after an
-- app-level role check, so RLS is ON with no policies for anon/authenticated.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.cohort_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program          TEXT        NOT NULL,
  snapshot_date    DATE        NOT NULL,
  filename         TEXT,
  file_size_bytes  INTEGER,
  row_count        INTEGER     NOT NULL DEFAULT 0,
  learner_count    INTEGER     NOT NULL DEFAULT 0,
  total_hours      NUMERIC     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing', 'ready', 'failed')),
  uploaded_by      TEXT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_cohort_snapshots_program_date
  ON public.cohort_snapshots (program, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.cohort_snapshot_rows (
  id                  BIGSERIAL PRIMARY KEY,
  snapshot_id         UUID    NOT NULL REFERENCES public.cohort_snapshots(id) ON DELETE CASCADE,
  email               TEXT    NOT NULL,
  name                TEXT,
  course_id           TEXT    NOT NULL,
  course_name         TEXT,
  university          TEXT,
  course_type         TEXT,
  enrollment_time     TIMESTAMPTZ,
  last_activity_time  TIMESTAMPTZ,
  overall_progress    NUMERIC NOT NULL DEFAULT 0,
  learning_hours      NUMERIC NOT NULL DEFAULT 0,  -- CUMULATIVE, as exported by Coursera
  completed           BOOLEAN NOT NULL DEFAULT FALSE,
  completion_time     TIMESTAMPTZ,
  course_grade        NUMERIC,
  removed_from_program BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE when the course was missing from this export for a learner who is
  -- still in it, so the previous snapshot's values were copied forward.
  carried_forward     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (snapshot_id, email, course_id)
);
CREATE INDEX IF NOT EXISTS idx_cohort_snapshot_rows_snapshot_email
  ON public.cohort_snapshot_rows (snapshot_id, email);
CREATE INDEX IF NOT EXISTS idx_cohort_snapshot_rows_email
  ON public.cohort_snapshot_rows (email);

CREATE TABLE IF NOT EXISTS public.cohorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program     TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  archived    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program, name)
);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  id         BIGSERIAL PRIMARY KEY,
  cohort_id  UUID        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,          -- lowercased
  alt_email  TEXT,                          -- lowercased; e.g. the email used on Coursera
  name       TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,                   -- soft removal keeps history
  UNIQUE (cohort_id, email)
);
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON public.cohort_members (cohort_id);

CREATE TABLE IF NOT EXISTS public.cohort_activity_log (
  id            BIGSERIAL PRIMARY KEY,
  action        TEXT        NOT NULL,  -- snapshot_upload | snapshot_delete | cohort_create | cohort_update | cohort_delete | members_upload | member_remove
  program       TEXT,
  cohort_id     UUID,
  snapshot_id   UUID,
  status        TEXT        NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  details       JSONB,
  error_message TEXT,
  duration_ms   INTEGER,
  performed_by  TEXT,
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cohort_activity_log_at ON public.cohort_activity_log (performed_at DESC);

ALTER TABLE public.cohort_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_snapshot_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_activity_log  ENABLE ROW LEVEL SECURITY;

-- Belt and braces: the browser keys never touch these tables directly.
REVOKE ALL ON public.cohort_snapshots, public.cohort_snapshot_rows, public.cohorts,
              public.cohort_members, public.cohort_activity_log
  FROM anon, authenticated;
