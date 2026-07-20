-- Table for storing user-reported issues and metric discrepancies
CREATE TABLE IF NOT EXISTS reported_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT,
  reporter_name TEXT,
  reporter_email TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT 'hour_discrepancy',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reported_issues ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public) to submit an issue report
CREATE POLICY "Allow public insert to reported_issues"
ON reported_issues FOR INSERT TO public WITH CHECK (true);

-- Allow authenticated admins to view issues
CREATE POLICY "Allow authenticated read to reported_issues"
ON reported_issues FOR SELECT TO authenticated USING (true);
