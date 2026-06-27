# Coursera Dashboard — Complete Build Instructions
**For Navgurukul Internal Web App (Next.js + Supabase)**
**Version 2 — Foolproof Edition**

---

## Read This First

This document is the single source of truth for building the Coursera analytics module.
Your coding agent should read this top to bottom before writing a single line of code.

### Key Facts About The Data (Do Not Skip)

1. **Every file is cumulative.** The April file contains all learning hours since the beginning of time up to April 30. Not just April's hours. This means you **must compute the monthly delta yourself** by subtracting the previous month's hours from the current month's hours.

2. **Hours occasionally go slightly down** between months (Coursera corrections). The maximum regression observed in the real data is -0.05 hours. Always `Math.max(0, delta)` — floor all deltas at zero.

3. **Regressions are floating-point noise, not real drops.** In 13,834 matched rows between March and April, 557 had tiny negative deltas. The largest was -0.05h. Do not alert on these. Floor to zero silently.

4. **New learners appear each month.** April had 37 learners not present in March. Their previous hours = 0, so their delta = their total hours.

5. **Last Course Activity Time is null for ~2,100 rows** in every file. This is normal — it means the learner enrolled but never opened the course.

6. **Course Type values in real data:** `Course`, `Guided Project`, `Self-Paced Project`, `Qwiklabs Project`. Your import must accept all four.

7. **Emails are the learner identifier.** Always `.trim().toLowerCase()` before storing or comparing. The data has no duplicates on `(email, course_id)` within a single month's file.

8. **The March file has a different sheet name** from April/May:
   - March: sheet name is `"Course Activity"`
   - April and May: sheet name is `"Learner Activity"`
   - Your parser must try both names.

9. **Scale:** ~14,600 rows per file, ~2,157 unique learners, ~58,600 cumulative hours as of May 2026.

---

## Architecture Overview

```
UPLOAD (once a month)
  └─→ Parse XLSX
       └─→ Upsert into coursera_snapshots  (raw, never touched again)
            └─→ Compute all metrics in JS
                 ├─→ Upsert into coursera_learner_month  (per learner per month)
                 └─→ Upsert into coursera_computed_metrics  (JSONB blob per month)

DASHBOARD (every page load)
  └─→ SELECT metrics FROM coursera_computed_metrics WHERE month = ?
       └─→ Return JSON blob → render everything
            (zero aggregation, zero joins, zero recalculation at read time)
```

The dashboard **never reads** `coursera_snapshots` or `coursera_learner_month` directly.
Those tables exist to allow recalculation and rollback — not to serve the UI.

---

## Section 1: Database Schema

Run this entire block in Supabase SQL Editor. Run it once. It is idempotent.

```sql
-- ================================================================
-- TABLE 1: coursera_config
-- Single row. Controls thresholds used in metric computation.
-- ================================================================
CREATE TABLE IF NOT EXISTS coursera_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  minimum_monthly_hours NUMERIC  DEFAULT 20.0,
  inactive_after_days   INTEGER  DEFAULT 90,
  total_licenses        INTEGER  DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO coursera_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ================================================================
-- TABLE 2: coursera_snapshots
-- Raw import target. INSERT ONLY. Never updated or deleted by app logic.
-- One row per (snapshot_month, email, course_id).
-- ================================================================
CREATE TABLE IF NOT EXISTS coursera_snapshots (
  id                        BIGSERIAL PRIMARY KEY,
  snapshot_month            DATE         NOT NULL,
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

  UNIQUE (snapshot_month, email, course_id)
);

CREATE INDEX IF NOT EXISTS idx_snap_month        ON coursera_snapshots (snapshot_month);
CREATE INDEX IF NOT EXISTS idx_snap_email        ON coursera_snapshots (email);
CREATE INDEX IF NOT EXISTS idx_snap_email_course ON coursera_snapshots (email, course_id);

-- ================================================================
-- TABLE 3: coursera_learner_month
-- Pre-aggregated per learner per month. Written at import time.
-- Used only for learner drilldown pages.
-- ================================================================
CREATE TABLE IF NOT EXISTS coursera_learner_month (
  id                   BIGSERIAL PRIMARY KEY,
  month                DATE    NOT NULL,
  email                TEXT    NOT NULL,
  name                 TEXT,
  monthly_hours        NUMERIC NOT NULL DEFAULT 0,
  cumulative_hours     NUMERIC NOT NULL DEFAULT 0,
  courses_enrolled     INTEGER          DEFAULT 0,
  courses_active       INTEGER          DEFAULT 0,
  courses_completed    INTEGER          DEFAULT 0,
  new_completions      INTEGER          DEFAULT 0,
  avg_progress         NUMERIC          DEFAULT 0,
  is_active            BOOLEAN          DEFAULT FALSE,
  is_compliant         BOOLEAN          DEFAULT FALSE,
  days_since_activity  INTEGER,

  UNIQUE (month, email)
);

CREATE INDEX IF NOT EXISTS idx_lm_month ON coursera_learner_month (month);
CREATE INDEX IF NOT EXISTS idx_lm_email ON coursera_learner_month (email);

-- ================================================================
-- TABLE 4: coursera_computed_metrics
-- One JSONB blob per month. This is ALL the dashboard reads.
-- Written at import time, re-writable via recalculate.
-- ================================================================
CREATE TABLE IF NOT EXISTS coursera_computed_metrics (
  id           BIGSERIAL PRIMARY KEY,
  month        DATE    NOT NULL UNIQUE,
  metrics      JSONB   NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cm_month ON coursera_computed_metrics (month);

-- ================================================================
-- TABLE 5: coursera_import_log
-- Audit trail for every upload and rollback.
-- ================================================================
CREATE TABLE IF NOT EXISTS coursera_import_log (
  id                BIGSERIAL PRIMARY KEY,
  snapshot_month    DATE    NOT NULL,
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
```

---

## Section 2: Upload Template XLSX

The upload template is a pre-formatted XLSX file the admin downloads, fills with Coursera export data, and uploads. It makes column names explicit and prevents header row confusion.

### Template sheet name: `"Learner Activity"`
### Template columns (in this exact order):

| Column Header | Data Type | Required | Example Value | Notes |
|---|---|---|---|---|
| `Email` | text | YES | anjalit22@navgurukul.org | Trimmed, lowercased on import |
| `Name` | text | YES | Anjali Tiwari | |
| `Course ID` | text | YES | W_mOXCrdEeeNPQ68_4aPpA | Coursera's internal ID |
| `Course` | text | YES | Neural Networks and Deep Learning | |
| `University` | text | YES | DeepLearning.AI | |
| `Course Type` | text | YES | Course | One of: Course, Guided Project, Self-Paced Project, Qwiklabs Project |
| `Learning Hours` | number | YES | 0.73 | CUMULATIVE hours since enrollment. NOT this month's hours. |
| `Overall Progress` | number | YES | 1.41 | 0–100 percentage |
| `Completed` | text | YES | No | "Yes" or "No" only |
| `Last Course Activity Time` | datetime | NO | 2024-01-26 10:26:59 | Can be blank if never opened |
| `Enrollment Time` | datetime | NO | 2024-01-26 10:16:04 | |
| `Completion Time` | datetime | NO | 2023-08-17 09:53:36 | Blank if not completed |
| `Course Grade` | number | NO | 0.0 | 0.0–1.0, can be blank |
| `Removed From Program` | text | NO | Yes | "Yes" or "No", defaults to No |
| `Program Name` | text | NO | NavGurukul | |

### How to generate the template file

Create a Next.js API route at `GET /api/coursera/template` that:
1. Uses the `xlsx` npm package to create a workbook
2. Creates a sheet named `"Learner Activity"`
3. Writes the header row (column names above, in order)
4. Adds a second row with example data (values from the table above)
5. Freezes the first row (`!freeze: { xSplit: 0, ySplit: 1 }`)
6. Sets column widths appropriately (Email=30, Name=20, Course=40, rest=20)
7. Returns with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="coursera_upload_template.xlsx"`

### How the admin uses it

The admin downloads the Coursera "Learner Activity" export as XLSX from Coursera's dashboard, which already uses these exact column names. They can upload it directly — the template is for reference and for months when they need to manually add or correct rows.

---

## Section 3: Import API Route

**File:** `src/app/api/coursera/import/route.ts`
**Method:** `POST`
**Content-Type:** `multipart/form-data`
**Fields:**
- `file` — the XLSX file
- `snapshotMonth` — string in format `"YYYY-MM-DD"` representing the last day of the month (e.g., `"2026-03-31"`)
- `uploadedBy` — string, email of the admin doing the upload (optional)

### Complete Algorithm (implement exactly in this order)

```
STEP 0: Validate inputs
  - snapshotMonth must be a valid date string matching /^\d{4}-\d{2}-\d{2}$/
  - Parse it as a Date. If invalid, return 400.
  - Check that no import already exists for this month:
      SELECT COUNT(*) FROM coursera_import_log
      WHERE snapshot_month = $snapshotMonth AND action = 'import' AND status = 'success'
    If count > 0, return 409 with message:
      "A successful import already exists for this month. 
       Use rollback first if you want to re-import."

STEP 1: Parse the XLSX file
  - Use the xlsx npm package: XLSX.read(buffer, { type: 'buffer', cellDates: true })
  - Try sheet names in this order: "Learner Activity", "Course Activity"
  - If neither sheet exists, return 400 with the actual sheet names found.
  - Read all rows: XLSX.utils.sheet_to_json(sheet, { defval: null })
  
STEP 2: Validate the parsed rows
  - Required columns that must exist: Email, Name, Course ID, Course, University,
    Course Type, Learning Hours, Overall Progress, Completed
  - Check the first row to confirm these headers exist. If any are missing,
    return 400 listing which columns are missing.
  - Filter out any rows where Email or Course ID is null/empty. Log count of skipped rows.

STEP 3: Transform rows to snapshot objects
  For each valid row, create an object:
  {
    snapshot_month:            snapshotMonth,  // the date string from the request
    email:                     row["Email"].toString().trim().toLowerCase(),
    name:                      row["Name"]?.toString().trim() || null,
    course_id:                 row["Course ID"]?.toString().trim(),
    course_name:               row["Course"]?.toString().trim() || null,
    course_slug:               row["Course Slug"]?.toString().trim() || null,
    university:                row["University"]?.toString().trim() || null,
    course_type:               row["Course Type"]?.toString().trim() || null,
    program_name:              row["Program Name"]?.toString().trim() || null,
    enrollment_time:           parseDate(row["Enrollment Time"]),
    last_activity_time:        parseDate(row["Last Course Activity Time"]),
    overall_progress:          parseFloat(row["Overall Progress"]) || 0,
    cumulative_learning_hours: parseFloat(row["Learning Hours"]) || 0,
    completed:                 row["Completed"]?.toString().trim() === "Yes",
    removed_from_program:      row["Removed From Program"]?.toString().trim() === "Yes",
    completion_time:           parseDate(row["Completion Time"]),
    course_grade:              row["Course Grade"] != null ? parseFloat(row["Course Grade"]) : null,
  }

  parseDate helper:
    - If value is already a JS Date object (xlsx cellDates:true does this), use it directly
    - If string, try new Date(value). If invalid, return null.
    - If null/undefined, return null.

STEP 4: Upsert snapshots into coursera_snapshots
  - Use Supabase client .upsert(rows, { onConflict: 'snapshot_month,email,course_id' })
  - Batch in chunks of 500 rows to avoid payload limits
  - If any batch fails, return 500 with the error. The UNIQUE constraint means
    re-running the same file is safe — it will update existing rows.

STEP 5: Compute monthly metrics (all in memory, no per-learner DB queries)

  5a. Fetch config:
      SELECT minimum_monthly_hours, inactive_after_days, total_licenses
      FROM coursera_config WHERE id = 1

  5b. Find the previous snapshot month:
      SELECT MAX(snapshot_month) FROM coursera_snapshots
      WHERE snapshot_month < $snapshotMonth
      (Result: prevMonth. May be null if this is the first import.)

  5c. If prevMonth is not null, fetch previous month's per-learner totals:
      SELECT email, SUM(cumulative_learning_hours) as prev_hours,
             COUNT(*) FILTER (WHERE completed = TRUE) as prev_completions
      FROM coursera_snapshots
      WHERE snapshot_month = $prevMonth
      GROUP BY email
      → Store as a Map: email → { prev_hours, prev_completions }

  5d. Group current month's rows by email (in JS, not SQL):
      const byEmail = new Map()
      for each transformed row:
        if not byEmail.has(email): byEmail.set(email, [])
        byEmail.get(email).push(row)

  5e. For each unique email, compute learner_month record:
      const rows = byEmail.get(email)
      const prev = prevMap.get(email) || { prev_hours: 0, prev_completions: 0 }

      cumulative_hours  = sum of all rows[i].cumulative_learning_hours
      monthly_hours     = Math.max(0, cumulative_hours - prev.prev_hours)
      
      courses_enrolled  = rows.length
      
      courses_completed = rows.filter(r => r.completed).length  (current month's completions, cumulative)
      new_completions   = Math.max(0, courses_completed - prev.prev_completions)
      
      avg_progress      = rows.reduce((sum, r) => sum + r.overall_progress, 0) / rows.length

      // Active = had any learning hours this month
      is_active = monthly_hours > 0

      // Courses active this month = courses where last_activity_time falls within
      // the calendar month of snapshotMonth
      const monthYear = snapshotMonth.substring(0, 7)  // "2026-03"
      courses_active = rows.filter(r => 
        r.last_activity_time && 
        r.last_activity_time.toISOString().substring(0, 7) === monthYear
      ).length

      // Days since last activity across all courses for this learner
      const latestActivity = rows
        .filter(r => r.last_activity_time)
        .map(r => r.last_activity_time)
        .sort((a, b) => b - a)[0]
      days_since_activity = latestActivity 
        ? Math.floor((new Date(snapshotMonth) - latestActivity) / 86400000) 
        : null

      is_compliant = monthly_hours >= config.minimum_monthly_hours

      Resulting object:
      {
        month: firstDayOfMonth(snapshotMonth),  // e.g. "2026-03-01"
        email, name: rows[0].name,
        monthly_hours, cumulative_hours,
        courses_enrolled, courses_active, courses_completed, new_completions,
        avg_progress, is_active, is_compliant, days_since_activity
      }

      firstDayOfMonth helper:
        const d = new Date(snapshotMonth)
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`

  5f. Upsert all learner_month records:
      supabase.from('coursera_learner_month')
        .upsert(learnerMonthRecords, { onConflict: 'month,email' })
      Batch in chunks of 500.

STEP 6: Compute the JSONB metrics blob

  Using the learnerMonthRecords computed in step 5e (already in memory):

  const currentRecords = learnerMonthRecords  // all learners for this month

  // Fetch previous month's learner_month records for MoM deltas
  let prevRecords = []
  if (prevMonth) {
    prevRecords = await supabase.from('coursera_learner_month')
      .select('*').eq('month', firstDayOfMonth(prevMonth))
  }
  const prevByEmail = new Map(prevRecords.map(r => [r.email, r]))

  // Historical totals (all-time)
  const allLearnerEmails = await supabase.from('coursera_snapshots')
    .select('email').not('email','is',null)
    // just get distinct count: use .select('email', { count: 'exact', head: true })
    // grouped — easier: just use the current + prev learner_month table
  // Actually: query all distinct emails ever from coursera_learner_month
  const { count: total_learners_ever } = await supabase
    .from('coursera_learner_month').select('email', { count: 'exact', head: true })
  // NOTE: this overcounts if same email in multiple months — use:
  // SELECT COUNT(DISTINCT email) FROM coursera_learner_month
  // via supabase.rpc('count_distinct_learners') — create this function:
  //   CREATE OR REPLACE FUNCTION count_distinct_learners()
  //   RETURNS INTEGER LANGUAGE SQL AS $$ SELECT COUNT(DISTINCT email)::INTEGER FROM coursera_learner_month $$;

  Build the metrics object:
  {
    // EXECUTIVE CARDS
    total_learners:              <result of count_distinct_learners()>,
    active_learners:             currentRecords.filter(r => r.is_active).length,
    inactive_learners:           currentRecords.filter(r => !r.is_active).length,
    compliant_learners:          currentRecords.filter(r => r.is_compliant).length,
    total_lifetime_hours:        currentRecords.reduce((s,r) => s + r.cumulative_hours, 0),
    monthly_hours:               currentRecords.reduce((s,r) => s + r.monthly_hours, 0),
    avg_hours_per_active_learner: <monthly_hours / active_learners or 0>,
    total_courses_enrolled:      currentRecords.reduce((s,r) => s + r.courses_enrolled, 0),
    total_courses_completed:     currentRecords.reduce((s,r) => s + r.courses_completed, 0),
    monthly_completions:         currentRecords.reduce((s,r) => s + r.new_completions, 0),
    overall_completion_rate:     <total_courses_completed / total_courses_enrolled * 100 or 0>,
    total_licenses:              config.total_licenses,
    licenses_active:             currentRecords.filter(r => r.is_active).length,
    license_utilization_pct:     config.total_licenses > 0 
                                   ? (licenses_active / config.total_licenses * 100) : null,

    // MOM DELTAS
    mom_active_learners:         active_learners - prevRecords.filter(r => r.is_active).length,
    mom_monthly_hours:           monthly_hours - prevRecords.reduce((s,r) => s + r.monthly_hours, 0),
    mom_completions:             monthly_completions - prevRecords.reduce((s,r) => s + r.new_completions, 0),
    new_learners_this_month:     currentRecords.filter(r => !prevByEmail.has(r.email)).length,
    reactivated_learners:        currentRecords.filter(r => 
                                   r.is_active && prevByEmail.has(r.email) && !prevByEmail.get(r.email).is_active
                                 ).length,
    became_inactive:             currentRecords.filter(r =>
                                   !r.is_active && prevByEmail.has(r.email) && prevByEmail.get(r.email).is_active
                                 ).length,

    // DISTRIBUTIONS (bucket counts)
    hours_distribution: {
      "0":    currentRecords.filter(r => r.monthly_hours === 0).length,
      "1-5":  currentRecords.filter(r => r.monthly_hours > 0 && r.monthly_hours <= 5).length,
      "6-10": currentRecords.filter(r => r.monthly_hours > 5 && r.monthly_hours <= 10).length,
      "11-20":currentRecords.filter(r => r.monthly_hours > 10 && r.monthly_hours <= 20).length,
      "21-40":currentRecords.filter(r => r.monthly_hours > 20 && r.monthly_hours <= 40).length,
      "40+":  currentRecords.filter(r => r.monthly_hours > 40).length,
    },
    progress_distribution: {
      "0%":     <learners with avg_progress === 0>,
      "1-25%":  <learners with avg_progress 1–25>,
      "26-50%": <learners with avg_progress 26–50>,
      "51-75%": <learners with avg_progress 51–75>,
      "76-99%": <learners with avg_progress 76–99>,
      "100%":   <learners with avg_progress === 100>,
    },

    // LEADERBOARDS (pre-sorted, top/bottom 20)
    top_learners_by_hours: currentRecords
      .sort((a,b) => b.monthly_hours - a.monthly_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours, 
                   cumulative_hours: r.cumulative_hours })),

    top_learners_by_cumulative: currentRecords
      .sort((a,b) => b.cumulative_hours - a.cumulative_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, cumulative_hours: r.cumulative_hours })),

    bottom_learners: currentRecords
      .filter(r => r.is_active)
      .sort((a,b) => a.monthly_hours - b.monthly_hours)
      .slice(0, 20)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours,
                   days_since_activity: r.days_since_activity })),

    // INTERVENTION LISTS
    learners_below_target: currentRecords
      .filter(r => r.is_active && !r.is_compliant)
      .sort((a,b) => a.monthly_hours - b.monthly_hours)
      .slice(0, 50)
      .map(r => ({ email: r.email, name: r.name, monthly_hours: r.monthly_hours })),

    learners_no_activity_30: currentRecords
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 30)
      .sort((a,b) => b.days_since_activity - a.days_since_activity)
      .slice(0, 50)
      .map(r => ({ email: r.email, name: r.name, days_since_activity: r.days_since_activity })),

    learners_no_activity_60: currentRecords
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 60)
      .length,   // just count for the card, full list fetched on-demand from learner_month

    learners_no_activity_90: currentRecords
      .filter(r => r.days_since_activity !== null && r.days_since_activity >= 90)
      .length,

    never_active: currentRecords.filter(r => r.days_since_activity === null).length,

    // ALERTS (for notification banners)
    alerts: [
      {
        type: 'below_target',
        count: currentRecords.filter(r => r.is_active && !r.is_compliant).length,
        threshold: config.minimum_monthly_hours,
      },
      {
        type: 'inactive_30',
        count: currentRecords.filter(r => r.days_since_activity >= 30).length,
      },
      {
        type: 'inactive_90',
        count: currentRecords.filter(r => r.days_since_activity >= 90).length,
      },
    ].filter(a => a.count > 0),

    // METADATA
    snapshot_month: snapshotMonth,
    config: {
      minimum_monthly_hours: config.minimum_monthly_hours,
      inactive_after_days: config.inactive_after_days,
      total_licenses: config.total_licenses,
    },
    generated_at: new Date().toISOString(),
  }

STEP 7: Upsert the metrics blob
  supabase.from('coursera_computed_metrics').upsert({
    month: firstDayOfMonth(snapshotMonth),
    metrics: metricsObject,
    generated_by: uploadedBy || null,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'month' })

STEP 8: Write to import log
  supabase.from('coursera_import_log').insert({
    snapshot_month:    snapshotMonth,
    filename:          file.name,
    file_size_bytes:   file.size,
    rows_imported:     transformedRows.length,
    learners_affected: byEmail.size,
    action:            'import',
    status:            'success',
    duration_ms:       Date.now() - startTime,
    imported_by:       uploadedBy || null,
  })

STEP 9: Return response
  return NextResponse.json({
    success: true,
    rowsImported: transformedRows.length,
    learnersAffected: byEmail.size,
    skippedRows: totalRows - transformedRows.length,
    durationMs: Date.now() - startTime,
    month: firstDayOfMonth(snapshotMonth),
  })
```

---

## Section 4: Rollback API Route

**File:** `src/app/api/coursera/rollback/route.ts`
**Method:** `DELETE`
**Body JSON:** `{ "snapshotMonth": "2026-03-31" }`

```
STEP 1: Validate month format
STEP 2: Check that an import exists for this month:
  SELECT COUNT(*) FROM coursera_import_log 
  WHERE snapshot_month = $snapshotMonth AND action = 'import' AND status = 'success'
  If 0, return 404 "No import found for this month"

STEP 3: Check that no newer month depends on this one
  (Every month's delta references the previous month. Deleting March when April exists
   would make April's deltas wrong.)
  SELECT MIN(snapshot_month) FROM coursera_snapshots WHERE snapshot_month > $snapshotMonth
  If a newer month exists, return 409:
    "Cannot rollback March 2026 because April 2026 exists.
     Rollback months in reverse chronological order (newest first)."

STEP 4: Delete in order (FK-safe)
  DELETE FROM coursera_computed_metrics WHERE month = firstDayOfMonth(snapshotMonth)
  DELETE FROM coursera_learner_month WHERE month = firstDayOfMonth(snapshotMonth)
  DELETE FROM coursera_snapshots WHERE snapshot_month = $snapshotMonth

STEP 5: Write to import log
  INSERT INTO coursera_import_log
  (snapshot_month, action, status, imported_by)
  VALUES ($snapshotMonth, 'rollback', 'success', $requestedBy)

STEP 6: Return
  { success: true, message: "Rollback complete for March 2026" }
```

---

## Section 5: Recalculate API Route

**File:** `src/app/api/coursera/recalculate/route.ts`
**Method:** `POST`
**Body JSON:** `{ "snapshotMonth": "2026-03-31" }`

Use this when config changes (e.g., minimum_monthly_hours changed from 20 to 15) and
you want metrics recomputed without re-uploading the file.

```
STEP 1: Verify snapshots exist for this month
  SELECT COUNT(*) FROM coursera_snapshots WHERE snapshot_month = $snapshotMonth
  If 0, return 404

STEP 2: Re-fetch all snapshot rows for this month from coursera_snapshots
  SELECT * FROM coursera_snapshots WHERE snapshot_month = $snapshotMonth

STEP 3: Run steps 5–8 from the import algorithm above (the computation steps only)
  Do NOT re-parse any file. Just recompute from what's already in coursera_snapshots.

STEP 4: Overwrite coursera_learner_month and coursera_computed_metrics for this month
  (upsert with onConflict will handle this)

STEP 5: Log to coursera_import_log with action = 'recalculate'

STEP 6: Return { success: true, month: ..., durationMs: ... }
```

---

## Section 6: Dashboard Read API Routes

### `GET /api/coursera/metrics?month=2026-03-01`

```typescript
const { data } = await supabase
  .from('coursera_computed_metrics')
  .select('month, metrics, generated_at, generated_by')
  .eq('month', month)
  .single()

return NextResponse.json(data)
```

That's the entire route. The JSONB blob has everything.

### `GET /api/coursera/metrics/trend?months=6`

```typescript
const { data } = await supabase
  .from('coursera_computed_metrics')
  .select('month, metrics->active_learners, metrics->monthly_hours, metrics->monthly_completions, metrics->license_utilization_pct')
  .order('month', { ascending: false })
  .limit(months)

return NextResponse.json(data.reverse())  // chronological order for charts
```

### `GET /api/coursera/metrics/available-months`

```typescript
const { data } = await supabase
  .from('coursera_computed_metrics')
  .select('month, generated_at')
  .order('month', { ascending: false })

return NextResponse.json(data)
```

Used to populate the month selector dropdown on the dashboard.

### `GET /api/coursera/learner/[email]`

```typescript
const { data } = await supabase
  .from('coursera_learner_month')
  .select('*')
  .eq('email', email)
  .order('month', { ascending: true })

// Also get course list from latest snapshot
const { data: courses } = await supabase
  .from('coursera_snapshots')
  .select('*')
  .eq('email', email)
  .eq('snapshot_month', latestSnapshotMonth)

return NextResponse.json({ monthlyHistory: data, courses })
```

---

## Section 7: Upload Management Frontend Page

**File:** `src/app/(dashboard)/data-management/import-coursera/page.tsx`

This is a **client component**. It has two sections: Upload and History.

### Upload Section

```
┌─────────────────────────────────────────────────────┐
│  Upload Coursera Report                              │
│                                                      │
│  Snapshot Month  [  March 2026  ▼  ]                 │
│  (The last day of the month this file covers)        │
│                                                      │
│  [ Drop XLSX file here or click to browse ]          │
│                                                      │
│  ⬇ Download Upload Template                         │
│                                                      │
│  [ Upload and Process ]                              │
│                                                      │
│  ──────────────────────────────────                  │
│  ✓ 14,633 rows imported                              │
│  ✓ 2,157 learners processed                          │
│  ✓ Metrics computed in 3.2s                          │
└─────────────────────────────────────────────────────┘
```

**Snapshot Month dropdown** should show months that do NOT already have a successful import
(fetch from `/api/coursera/metrics/available-months` and exclude those months from the
available options, OR allow re-upload only after rollback).

**Validation before upload:**
- File must end in `.xlsx`
- Snapshot month must be selected
- Show file name and size after selection

**After upload:**
- Show success state with row counts
- Redirect or refresh the history table

### Import History Section

```
┌──────────────────────────────────────────────────────────────────────┐
│  Import History                                                       │
│                                                                       │
│  Month       Filename              Rows    Learners  Status  Actions │
│  ─────────────────────────────────────────────────────────────────── │
│  May 2026    Coursera_May.xlsx    14,633   2,157    ✓ OK    [↩ Roll] │
│  Apr 2026    Coursera_Apr.xlsx    14,314   2,103    ✓ OK    [↩ Roll] │
│  Mar 2026    Coursera_Mar.xlsx    13,837   2,066    ✓ OK    [↩ Roll] │
└──────────────────────────────────────────────────────────────────────┘
```

**Rollback button behavior:**
- Show a confirmation modal: "This will delete all data for [Month]. Months must be rolled back in reverse order (newest first). Are you sure?"
- If a newer month exists, the rollback button for older months should be disabled with tooltip: "Rollback May 2026 first"
- After rollback, the row disappears from history and the month becomes available to re-upload

**Fetch import history from:**
```sql
SELECT snapshot_month, filename, rows_imported, learners_affected, 
       action, status, duration_ms, imported_by, imported_at
FROM coursera_import_log
ORDER BY imported_at DESC
```

---

## Section 8: Dashboard Page

**File:** `src/app/(dashboard)/data-management/coursera/page.tsx`

This is a **server component** that fetches the metrics blob on the server, passes it to client child components.

```typescript
// server component - fetches data
const { month } = searchParams  // from URL ?month=2026-03-01
const targetMonth = month || (await getLatestAvailableMonth())

const [metricsRes, trendRes] = await Promise.all([
  fetch(`/api/coursera/metrics?month=${targetMonth}`),
  fetch(`/api/coursera/metrics/trend?months=6`),
])

const { metrics } = await metricsRes.json()
const trend = await trendRes.json()

// Pass to client components
return <CourseraDashboard metrics={metrics} trend={trend} selectedMonth={targetMonth} />
```

### Dashboard layout

```
Month Selector: [ March 2026 | April 2026 | May 2026 ← selected ]

ROW 1 — 4 cards
  Total Learners      Active Learners     Monthly Hours     Lifetime Hours
  2,157               303 (↑12)           931h              58,622h

ROW 2 — 4 cards  
  Compliant           Inactive            Completions       License Usage
  6 learners          1,854               47 (↑3)           303/500 (60.6%)

ROW 3 — 2 charts (side by side)
  Monthly Learning Hours (bar)    Active Learners (line)
  [last 6 months]                 [last 6 months]

ROW 4 — 2 charts
  Hours Distribution (bar)        Progress Distribution (bar)
  [0, 1-5, 6-10, 11-20, 21-40, 40+]

ROW 5 — 2 tables side by side
  Top 10 Learners (by hours)     Needs Intervention
  name | hours | cumulative      name | hours | days inactive

ROW 6 — Alerts (only if alerts exist)
  ⚠ 297 learners below 20h target
  ⚠ 1,854 learners inactive this month
```

**Chart data source:** All from `metrics` blob and `trend` array. Zero additional fetches.

---

## Section 9: Activity Logs Page

**File:** `src/app/(dashboard)/data-management/coursera/activity-logs/page.tsx`

Server component with URL-based filters (not client-side state, so filters are shareable links).

URL params: `?month=2026-03-01&search=anjali&status=active&page=1`

```typescript
// Single query to coursera_learner_month
const { data, count } = await supabase
  .from('coursera_learner_month')
  .select('*', { count: 'exact' })
  .eq('month', month)
  .ilike('name', search ? `%${search}%` : '%')  // or email
  .eq('is_active', statusFilter === 'active' ? true : undefined)
  .order('monthly_hours', { ascending: false })
  .range(offset, offset + 49)

// Renders a table with pagination
// Columns: Name | Email | Monthly Hours | Cumulative | Courses | Completed | Active | Compliant | Days Since Activity
```

Filter bar:
- Month selector (same as dashboard)
- Search (name or email)
- Status: All / Active Only / Inactive Only / Below Target / No Activity 30d / 90d

Each row links to `/data-management/coursera/learner/[email]`.

---

## Section 10: Learner Detail Page

**File:** `src/app/(dashboard)/data-management/coursera/learner/[email]/page.tsx`

Server component. Fetches:
1. All months from `coursera_learner_month` for this learner → monthly hours timeline chart
2. All courses from latest snapshot in `coursera_snapshots` → course list with progress

```
Learner: Anjali Tiwari (anjalit22@navgurukul.org)

Lifetime Hours: 31.4h   Courses Enrolled: 27   Completed: 3

Monthly Hours (bar chart, all months available)
  Mar | Apr | May ...

Course List
  Course Name               Progress   Hours   Completed   Last Active
  Neural Networks (Deep.AI) 1.4%       0.73h   No          Jan 2024
  Python for Everybody      80%        12.3h   No          Mar 2026
  ...
```

---

## Section 11: Navigation Wiring

**File:** `src/app/(dashboard)/data-management/page.tsx`

Add to `dataManagementSections`:

```typescript
{
  title: 'Coursera',
  items: [
    { label: 'Dashboard',       href: '/data-management/coursera' },
    { label: 'Activity Logs',   href: '/data-management/coursera/activity-logs' },
    { label: 'Import Reports',  href: '/data-management/import-coursera' },
  ]
}
```

---

## Section 12: npm Packages Required

```bash
npm install xlsx       # SheetJS — parse and create .xlsx files
```

Everything else (Supabase, Next.js, React) you already have.

---

## Section 13: First-Time Setup Checklist

Run through this in order once the code is deployed:

- [ ] 1. Run the SQL schema block in Supabase SQL Editor
- [ ] 2. Run the `count_distinct_learners` SQL function in Supabase:
         ```sql
         CREATE OR REPLACE FUNCTION count_distinct_learners()
         RETURNS INTEGER LANGUAGE SQL AS $$
           SELECT COUNT(DISTINCT email)::INTEGER FROM coursera_learner_month
         $$;
         ```
- [ ] 3. Set your license count in config:
         ```sql
         UPDATE coursera_config SET total_licenses = 500 WHERE id = 1;
         -- Replace 500 with your actual Coursera license count
         ```
- [ ] 4. Import March file first: Upload at `/data-management/import-coursera`
         - Snapshot Month = `2026-03-31`
         - Expect: 13,837 rows, 2,066 learners
- [ ] 5. Import April file:
         - Snapshot Month = `2026-04-30`
         - Expect: 14,314 rows, 2,103 learners
         - April monthly hours should total ~931h
- [ ] 6. Import May file:
         - Snapshot Month = `2026-05-31`
         - Expect: 14,633 rows, 2,157 learners
         - May monthly hours should total ~908h
- [ ] 7. Verify dashboard loads at `/data-management/coursera`
         - Select May 2026
         - Confirm: Active Learners = 175, Monthly Hours ≈ 908h

---

## Section 14: Common Mistakes to Avoid

1. **Do not read `coursera_snapshots` from the dashboard.** Ever. Only read `coursera_computed_metrics`.

2. **Do not compute deltas at query time.** Deltas are computed once at import time and stored in `coursera_learner_month.monthly_hours`.

3. **Do not allow importing the same month twice** without a rollback in between. The import route checks for this in Step 0.

4. **Do not roll back an older month if a newer month exists.** The rollback route checks for this in Step 3.

5. **Always normalize emails:** `.trim().toLowerCase()` on every email before any DB operation.

6. **The March file has sheet name "Course Activity".** The import parser must try both `"Learner Activity"` and `"Course Activity"`.

7. **Regressions are normal.** 557 rows had tiny negative deltas (max -0.05h) between March and April. Always `Math.max(0, delta)`. Never alert on regressions smaller than 0.5h.

8. **`Last Course Activity Time` is null for ~2,100 rows.** This is normal. Don't filter these rows out — just store null and handle null in days_since_activity calculation.

9. **`firstDayOfMonth` must produce a clean date string.** Use string manipulation on the input (`snapshotMonth.substring(0,7) + "-01"`) rather than `new Date()` constructor to avoid timezone shifting.

10. **Batch all Supabase inserts in chunks of 500.** A 14,633-row single upsert will timeout or hit payload limits.

