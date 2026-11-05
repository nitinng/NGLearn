-- ================================================================
-- Beta report data + large-file uploads.
-- Run once in the NGLearn project (safe to re-run).
--   1. Extra Course Activity columns on coursera_snapshots
--   2. Tables for the other sheets in the Coursera export:
--      Specialisation Activity, Program Activity, Video Clip Activity
--   3. A private Storage bucket so exports larger than ~4.5 MB can be
--      uploaded (the browser uploads straight to Storage).
-- Like the other tables: RLS on, no browser-role access.
-- ================================================================

BEGIN;

-- 1. Extra Course Activity columns
ALTER TABLE public.coursera_snapshots
  ADD COLUMN IF NOT EXISTS external_id      TEXT,
  ADD COLUMN IF NOT EXISTS class_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS class_end_time   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collection_id    TEXT,
  ADD COLUMN IF NOT EXISTS collection_name  TEXT,
  ADD COLUMN IF NOT EXISTS contract         TEXT,
  ADD COLUMN IF NOT EXISTS contract_active  BOOLEAN,
  ADD COLUMN IF NOT EXISTS business_unit    TEXT,
  ADD COLUMN IF NOT EXISTS job_title        TEXT;

-- 2a. Specialisation Activity (one row per learner per specialization per snapshot)
CREATE TABLE IF NOT EXISTS public.coursera_specialization_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  snapshot_month         DATE    NOT NULL,          -- weekly snapshot (Sunday)
  email                  TEXT    NOT NULL,
  name                   TEXT,
  specialization         TEXT,
  specialization_slug    TEXT    NOT NULL,
  university             TEXT,
  enrollment_time        TIMESTAMPTZ,
  last_activity_time     TIMESTAMPTZ,
  completed_courses      INTEGER NOT NULL DEFAULT 0,
  total_courses          INTEGER NOT NULL DEFAULT 0,
  completed              BOOLEAN NOT NULL DEFAULT FALSE,
  removed_from_program   BOOLEAN NOT NULL DEFAULT FALSE,
  completion_time        TIMESTAMPTZ,
  certificate_url        TEXT,
  estimated_learning_hours NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (snapshot_month, email, specialization_slug)
);
CREATE INDEX IF NOT EXISTS idx_spec_snap_email ON public.coursera_specialization_snapshots (email);

-- 2b. Program Activity (one row per learner per snapshot): membership + totals
CREATE TABLE IF NOT EXISTS public.coursera_program_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  snapshot_month         DATE    NOT NULL,
  email                  TEXT    NOT NULL,
  name                   TEXT,
  member_state           TEXT,                      -- MEMBER | INVITED | SOFT_DELETED_MEMBER | DELETED_MEMBER
  enrolled_courses       INTEGER NOT NULL DEFAULT 0,
  completed_courses      INTEGER NOT NULL DEFAULT 0,
  join_date              TIMESTAMPTZ,
  invitation_date        TIMESTAMPTZ,
  last_program_activity  TIMESTAMPTZ,
  learning_hours         NUMERIC NOT NULL DEFAULT 0,
  business_unit          TEXT,
  job_title              TEXT,
  UNIQUE (snapshot_month, email)
);
CREATE INDEX IF NOT EXISTS idx_prog_snap_email ON public.coursera_program_snapshots (email);

-- 2c. Video Clip Activity (one row per learner per clip per snapshot)
CREATE TABLE IF NOT EXISTS public.coursera_clip_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  snapshot_month         DATE    NOT NULL,
  email                  TEXT    NOT NULL,
  name                   TEXT,
  course_id              TEXT,
  course_name            TEXT,
  clip_name              TEXT    NOT NULL,
  clip_title             TEXT,
  clip_url               TEXT,
  first_activity_time    TIMESTAMPTZ,
  last_activity_time     TIMESTAMPTZ,
  estimated_learning_hours NUMERIC NOT NULL DEFAULT 0,
  progress_pct           NUMERIC NOT NULL DEFAULT 0,
  times_watched          INTEGER NOT NULL DEFAULT 0,
  completed_90           BOOLEAN NOT NULL DEFAULT FALSE,
  led_to_enrollment      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (snapshot_month, email, clip_name)
);
CREATE INDEX IF NOT EXISTS idx_clip_snap_email ON public.coursera_clip_snapshots (email);

ALTER TABLE public.coursera_specialization_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_program_snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coursera_clip_snapshots           ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coursera_specialization_snapshots, public.coursera_program_snapshots, public.coursera_clip_snapshots FROM anon, authenticated;
GRANT  ALL ON public.coursera_specialization_snapshots, public.coursera_program_snapshots, public.coursera_clip_snapshots TO service_role;
GRANT  ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Private bucket for uploads (files are deleted after import)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('coursera-imports', 'coursera-imports', false, 52428800,
        ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
