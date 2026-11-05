-- ================================================================
-- NGLearn database schema (Coursera weekly tracking + cohorts)
--
-- Run ONCE on an empty database, after supabase/reset/00_wipe_public_schema.sql.
-- Tables mirror NGConnect's Coursera module, with one difference:
-- snapshots are WEEKLY. The `snapshot_month` / `month` columns keep
-- NGConnect's names but hold the exact export date (YYYY-MM-DD), not
-- the first day of a month.
--
-- Access model: RLS is ON for every table with no policies, and the
-- browser roles (anon, authenticated) have no table grants. The Next.js
-- server reads/writes with the service role after checking the user's
-- role (src/lib/access.ts).
-- ================================================================

BEGIN;

-- ── 1. Settings (single row) ─────────────────────────────────────
CREATE TABLE public.coursera_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  minimum_monthly_hours NUMERIC NOT NULL DEFAULT 5,   -- weekly hours target ("compliant" learners)
  inactive_after_days   INTEGER NOT NULL DEFAULT 90,
  total_licenses        INTEGER NOT NULL DEFAULT 0,   -- Coursera seats; 0 hides license utilisation
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN public.coursera_config.minimum_monthly_hours IS 'Hours a learner must log between two weekly snapshots to count as on target.';
INSERT INTO public.coursera_config (id) VALUES (1);

-- ── 2. Raw weekly export rows ────────────────────────────────────
-- One row per (snapshot date, learner, course). Insert-only; deleted by rollback.
CREATE TABLE public.coursera_snapshots (
  id                        BIGSERIAL PRIMARY KEY,
  snapshot_month            DATE        NOT NULL,   -- weekly export date
  email                     TEXT        NOT NULL,
  name                      TEXT,
  course_id                 TEXT        NOT NULL,
  course_name               TEXT,
  course_slug               TEXT,
  university                TEXT,
  course_type               TEXT,
  program_name              TEXT,
  enrollment_time           TIMESTAMPTZ,
  last_activity_time        TIMESTAMPTZ,
  overall_progress          NUMERIC     NOT NULL DEFAULT 0,
  cumulative_learning_hours NUMERIC     NOT NULL DEFAULT 0,  -- cumulative since enrollment
  estimated_course_hours    NUMERIC,
  completed                 BOOLEAN     NOT NULL DEFAULT FALSE,
  removed_from_program      BOOLEAN     NOT NULL DEFAULT FALSE,
  completion_time           TIMESTAMPTZ,
  course_grade              NUMERIC,
  certificate_url           TEXT,
  imported_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_month, email, course_id)
);
CREATE INDEX idx_snap_month        ON public.coursera_snapshots (snapshot_month);
CREATE INDEX idx_snap_email        ON public.coursera_snapshots (email);
CREATE INDEX idx_snap_email_course ON public.coursera_snapshots (email, course_id);

-- ── 3. Per-learner, per-snapshot aggregates ──────────────────────
-- monthly_hours = hours learned since the PREVIOUS snapshot (i.e. weekly hours).
CREATE TABLE public.coursera_learner_month (
  id                  BIGSERIAL PRIMARY KEY,
  month               DATE    NOT NULL,   -- weekly snapshot date
  email               TEXT    NOT NULL,
  name                TEXT,
  monthly_hours       NUMERIC NOT NULL DEFAULT 0,
  cumulative_hours    NUMERIC NOT NULL DEFAULT 0,
  courses_enrolled    INTEGER NOT NULL DEFAULT 0,
  courses_active      INTEGER NOT NULL DEFAULT 0,  -- courses touched in the 7 days before the snapshot
  courses_completed   INTEGER NOT NULL DEFAULT 0,
  new_completions     INTEGER NOT NULL DEFAULT 0,
  avg_progress        NUMERIC NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  is_compliant        BOOLEAN NOT NULL DEFAULT FALSE,
  days_since_activity INTEGER,
  UNIQUE (month, email)
);
CREATE INDEX idx_lm_month ON public.coursera_learner_month (month);
CREATE INDEX idx_lm_email ON public.coursera_learner_month (email);

-- ── 4. Dashboard metrics (one JSON blob per snapshot) ────────────
CREATE TABLE public.coursera_computed_metrics (
  id           BIGSERIAL PRIMARY KEY,
  month        DATE        NOT NULL UNIQUE,  -- weekly snapshot date
  metrics      JSONB       NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by TEXT
);

-- ── 5. Import / rollback / recalculate audit trail ───────────────
CREATE TABLE public.coursera_import_log (
  id                BIGSERIAL PRIMARY KEY,
  snapshot_month    DATE        NOT NULL,
  filename          TEXT,
  file_size_bytes   INTEGER,
  rows_imported     INTEGER,
  learners_affected INTEGER,
  action            TEXT        NOT NULL DEFAULT 'import'  CHECK (action IN ('import', 'rollback', 'recalculate')),
  status            TEXT        NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
  error_message     TEXT,
  duration_ms       INTEGER,
  imported_by       TEXT,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_import_log_month ON public.coursera_import_log (snapshot_month, imported_at DESC);

-- ── 6. Cohorts (e.g. "Cohort 2", "Cohort 3") ─────────────────────
CREATE TABLE public.cohorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX cohorts_name_key ON public.cohorts (lower(name));

-- ── 7. Cohort members (Full Name + email per student) ────────────
CREATE TABLE public.cohort_members (
  id         BIGSERIAL PRIMARY KEY,
  cohort_id  UUID        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  full_name  TEXT,
  email      TEXT        NOT NULL CHECK (email = lower(email)),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, email)
);
CREATE INDEX idx_cohort_members_email ON public.cohort_members (email);

-- ── 8. Cohort-scoped views (what the app shows) ──────────────────
-- Full weekly reports are stored, but the dashboard, activity logs and
-- learner pages only ever show people who are in a cohort. Filtering at
-- read time means a student added to a cohort later shows up with their
-- full past history.
CREATE VIEW public.cohort_learner_month WITH (security_invoker = true) AS
SELECT cm.cohort_id, cm.full_name, lm.*
FROM public.coursera_learner_month lm
JOIN public.cohort_members cm ON cm.email = lm.email;

CREATE VIEW public.tracked_learner_month WITH (security_invoker = true) AS
SELECT
  (SELECT cm.full_name FROM public.cohort_members cm
    WHERE cm.email = lm.email AND cm.full_name IS NOT NULL
    ORDER BY cm.added_at DESC LIMIT 1) AS full_name,
  lm.*
FROM public.coursera_learner_month lm
WHERE EXISTS (SELECT 1 FROM public.cohort_members cm WHERE cm.email = lm.email);

-- ── Security ─────────────────────────────────────────────────────
ALTER TABLE public.coursera_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_learner_month    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_computed_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_import_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members            ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT  ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT  ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Check: 7 tables (all rls_on = true) and 2 views.
-- SELECT c.relname, c.relrowsecurity AS rls_on
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;

-- Next: run supabase/migrations/20261106000001_beta_report_data.sql (beta report data + upload bucket).
