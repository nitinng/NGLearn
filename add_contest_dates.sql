-- Alter contest_series
ALTER TABLE contest_series ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE contest_series ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Alter sub_contests
ALTER TABLE sub_contests ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::TIMESTAMPTZ;
ALTER TABLE sub_contests ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::TIMESTAMPTZ;
ALTER TABLE sub_contests ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE sub_contests ALTER COLUMN end_date SET NOT NULL;
