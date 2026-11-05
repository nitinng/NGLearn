# NGLearn setup (Coursera weekly tracking for Zuvy)

NGLearn runs NGConnect's Coursera module (Dashboard, Activity Logs, Export Activity Report,
Import Reports) on **weekly** Coursera exports, with **cohorts** as the report scope.
Learner enrollment and pruning are intentionally not included.

## Pages

| Path | Page |
|---|---|
| `/` | Home (greeting + shortcuts) |
| `/dashboard` | Dashboard (cohort-scoped Coursera analytics) |
| `/activity-logs` | Activity Logs |
| `/export` | Export Activity Report (Classic / Beta), cohorts |
| `/import-reports` | Import Reports (weekly uploads) |
| `/learners/[email]` | Learner detail |
| `/settings/users` | User Roles |
| `/settings/targets` | Coursera Targets (weekly hours target) |

Old `/data-management/...` links redirect to these.

## 1. Database (Supabase, NGLearn project)

1. Back up anything you need, then run `supabase/reset/00_wipe_public_schema.sql` in the SQL Editor.
   This empties the `public` schema (sign-in accounts and storage are untouched).
2. Run `supabase/schema.sql`. It creates 7 tables with RLS on:

| Table | Purpose |
|---|---|
| `coursera_config` | One row: weekly hours target, inactivity days, licence count |
| `coursera_snapshots` | Raw rows of each weekly Coursera export (per learner per course) |
| `coursera_learner_month` | Per learner per snapshot: hours since previous snapshot, totals, status |
| `coursera_computed_metrics` | Dashboard numbers, one JSON blob per snapshot |
| `coursera_import_log` | Import / rollback / recalculate history |
| `cohorts` | Named cohorts (Cohort 2, Cohort 3, ...) |
| `cohort_members` | Full name + email of each student in a cohort |
| `cohort_learner_month` (view) | Weekly learner rows for one cohort's members |
| `tracked_learner_month` (view) | Weekly learner rows for anyone in any cohort |

**Only cohort members are ever shown.** Every upload stores the full Coursera export (e.g. all 1,500
learners), but the Dashboard, Activity Logs, learner pages and exports read through the two views
above. Learners outside every cohort never appear. Adding someone to a cohort later shows their
full past history straight away, because their earlier weeks were stored.

If you ran `schema.sql` before the views were added, run
`supabase/migrations/20261106000000_cohort_scope_views.sql` once.

Column names `snapshot_month` / `month` are kept from NGConnect but hold the weekly export date.

3. Run `supabase/migrations/20261106000001_beta_report_data.sql`. It adds the extra Coursera columns and
   tables used by the **Beta report** (specializations, program membership, video clips) and creates the
   private `coursera-imports` Storage bucket. The browser uploads exports there, because Coursera exports
   (~5–6 MB) are larger than the ~4.5 MB request limit on Vercel. Files are deleted right after import.

## 2. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>      # server only
MASTER_USER_ID=<optional auth user id that is always Admin>

# Live Coursera checks in "Verify Users" and the export's unmatched sheet
COURSERA_CLIENT_ID=
COURSERA_CLIENT_SECRET=
COURSERA_ORG_ID=
COURSERA_PROGRAM_ID=        # the Zuvy program id; defaults to NGConnect's program if unset
```

Without the Coursera variables, reports still work from the uploaded exports; only the live
roster/invitation lookups are skipped.

## 3. Roles

Set on **Settings → User Roles** (stored in `auth.users.app_metadata.role`).

| Role | View dashboard, logs, export | Import reports, manage cohorts | Manage users |
|---|:-:|:-:|:-:|
| Admin, PNC | ✓ | ✓ | ✓ |
| CEOs Office | ✓ | | ✓ |
| Program | ✓ | ✓ | |
| Member | | | |

## 4. Weekly routine

Reports follow a fixed Monday → Sunday schedule so no day is counted twice:

1. **Once, at the start: baseline.** Import Coursera's lifetime report covering all learning up to a
   **Sunday**. Zuvy's agreed baseline is **Sunday 29 March 2026** (pre-selected), so Week 1 = Mon 30 Mar – Sun 5 Apr.
   It is labelled "Baseline · lifetime up to Sun 29 Mar 2026".
   The baseline is **not a week**: it stores no weekly hours, active learners, completions or changes, and the
   Dashboard / Activity Logs show only lifetime totals for it. Weekly figures start with the next upload,
   measured against the baseline. (If a baseline was imported before this rule, click **Recalculate** on it.)
2. **After that, every Monday:** generate the Coursera report **up to the previous Sunday. Do not include Monday.**
   The Import Reports dropdown lists every finished week after the last upload (newest pre-selected).
   Normally pick the newest week. If you skip weeks (for example going straight from the April baseline to
   this week, since Coursera can't export a past week), the skipped weeks are merged into one period,
   labelled by its end week, e.g. "Week 31 · report end date Sun 1 Nov 2026", and the weekly hours target is multiplied
   by the number of weeks. Uploads only move forward; nothing is counted twice.
3. **Coursera date range:** the page shows the exact range to pick for the selected period, e.g.
   *Learner activity date range → Custom → Start 04/01/2020 · End 11/01/2026* (the Sunday). Always use the same
   start date so every learner is included. The file's contents are not checked against dates (Coursera exports
   carry data up to the moment they're downloaded), so no warnings appear after upload.
4. Mistake? Roll back the newest week and import it again.
5. **Dashboard / Activity Logs**: pick a cohort tab (or "All cohorts"); weeks are labelled "Wk N · dates".
6. **Export Activity Report**: pick the week, pick a cohort card, optionally **Verify Users**, export.
7. New cohort: on the Export page click **Import Cohort** and upload an .xlsx with `Full Name` and an
   email column. Each sheet becomes one cohort named after the sheet (rename before saving).

## 5. Templates

Download links are on each import screen; the files live in `public/templates/`:

| Template | Used on | Contents |
|---|---|---|
| `coursera_weekly_report_template.xlsx` | Import Reports | "Learner Activity" sheet with every column the importer reads, plus instructions |
| `cohort_import_template.xlsx` | Export → Import Cohort | One sheet per cohort with `Full Name` and `NG email ID`, plus instructions |

Example rows use `@example.org` emails and are ignored by both importers. Regenerate the files with
`node scripts/generate-templates.mjs`.

## 6. Classic vs Beta report

Export Activity Report → **Report Type**:

- **Classic**: the original report, unchanged.
- **New report (BETA)**: the Classic sheets plus purple-tab sheets built from the rest of the Coursera export:
  - **Beta Summary**: cohort KPIs (program status counts, projects by type, specializations, certificates, clips) and top courses
  - **Learner 360**: per student: program status (Member / Invited / Deleted), invited and joined dates, hours this week,
    courses / projects / specializations enrolled and completed, certificates, average grade, days inactive
  - **Weekly Trend**: hours and active learners for each week since the baseline
  - **Projects**: Guided, Self-Paced and Qwiklabs projects
  - **Specializations**: progress through each specialization
  - **Course Details+**: class start/end dates, grade, certificate URL, collection, contract
  - **Video Clips**: clips watched, completion, whether they led to an enrollment

Weeks imported before migration 20261106000001 have no specialization/program/clip data; re-import them if needed.

## 7. Settings → Coursera Targets

Admin, PNC and Program roles can change the **weekly learning-hours target** (default 5 h; learners below it are
"below target") and the inactivity threshold. Saving re-checks every imported week against the new target.
