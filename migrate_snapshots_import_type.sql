-- ================================================================
-- IDEMPOTENT MIGRATION: Add import_type to contest_coursera_snapshots
-- Safe to re-run regardless of partial state.
-- ================================================================

-- Step 1: Add column if it doesn't already exist
ALTER TABLE contest_coursera_snapshots
  ADD COLUMN IF NOT EXISTS import_type TEXT NOT NULL DEFAULT 'contest_end'
    CHECK (import_type IN ('contest_start', 'contest_end'));

-- Step 2: Drop any old 3-column unique constraints (both possible names)
ALTER TABLE contest_coursera_snapshots
  DROP CONSTRAINT IF EXISTS contest_coursera_snapshots_sub_contest_id_email_course_id_key;

-- Step 3: Drop the 4-column constraint if it already exists (so we can safely re-add it)
ALTER TABLE contest_coursera_snapshots
  DROP CONSTRAINT IF EXISTS contest_coursera_snapshots_sub_contest_id_email_course_id_import_type_key;

-- Step 4: Add the correct 4-column unique constraint
ALTER TABLE contest_coursera_snapshots
  ADD CONSTRAINT contest_coursera_snapshots_sub_contest_id_email_course_id_import_type_key
  UNIQUE (sub_contest_id, email, course_id, import_type);
