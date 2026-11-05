# NGLearn setup (Coursera weekly tracking for Zuvy)

NGLearn runs NGConnect's Coursera module (Dashboard, Activity Logs, Export Activity Report,
Import Reports) on **weekly** Coursera exports, with **cohorts** as the report scope.
Learner enrollment and pruning are intentionally not included.

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

1. **Import Reports**: upload the full Coursera Learner Activity export and set the snapshot date
   (taken from the file name when present). Hours are computed against the previous snapshot.
2. **Dashboard / Activity Logs**: pick a cohort tab (or "All cohorts").
3. **Export Activity Report**: pick the snapshot, pick a cohort card, optionally **Verify Users**, export.
4. New cohort: on the Export page click **Import Cohort** and upload an .xlsx with `Full Name` and an
   email column. Each sheet becomes one cohort named after the sheet (rename before saving).
