# Cohort Tracking (Zuvy, MSDF)

Tracks Coursera learning for named cohorts (e.g. *Zuvy Cohort 2*, 121 learners) from weekly Coursera exports.

## How it works

1. **Upload the full export weekly.** Someone with the Program (or Admin/PNC) role uploads the *entire* Coursera
   "Learner Activity" `.xlsx` for the program on **Weekly Snapshots** (`/cohorts/snapshots`), with the date the export was taken.
   Coursera can't export a single cohort, so the whole file is stored and filtered later.
2. **A cohort is an email list.** Create a cohort on `/cohorts`, then add members on its **Members** tab by pasting emails
   (`email, alt email, name` per line) or uploading an `.xlsx`/`.csv` with an `Email` column. Use **Alt Email** when a learner
   signed in to Coursera with a different address.
3. **Reports compare two snapshots.** Coursera hours are cumulative, so for every member and course:
   `hours learned = hours in later snapshot − hours in earlier snapshot` (never below 0; a course missing from the earlier
   snapshot counts from 0; a course missing from the later one keeps its earlier value). The cohort page defaults to the
   latest snapshot vs the one before it, and any two snapshots can be picked. **Download Excel** gives Summary, Learners,
   Course Detail and Weekly Trend sheets.

Learner statuses: **Learned** (hours > 0 in the period), **No progress**, **Not on Coursera** (neither email appears in the
export), **On Coursera** (shown when there is no earlier snapshot to compare with).

When an upload has a learner whose course is missing compared with the previous snapshot, that course is carried forward
(`carried_forward = true`) so it is not counted as new hours if it reappears. Upload snapshots in date order; carry-forward
is not recomputed for later snapshots if an older one is inserted afterwards.

## Roles

Roles live in Supabase `auth.users.app_metadata.role` and are assigned on **Settings → User Roles**.

| Role        | Cohorts & reports | Upload snapshots / edit cohorts | Settings (users) |
|-------------|:-:|:-:|:-:|
| Admin       | ✓ | ✓ | ✓ |
| PNC         | ✓ | ✓ | ✓ |
| CEOs Office | ✓ |   | ✓ |
| Program     | ✓ | ✓ |   |
| Member      |   |   |   |

Give the Zuvy team the **Program** role.

## Database setup

The SQL files in `supabase/migrations/` run in filename order (Supabase SQL editor, or `supabase db push`):

1. `20261105000000_drop_legacy_coursera_and_contests.sql`: **deletes** the old monthly Coursera, contest,
   published-report and `ng_members` tables. Back up first if anything there is still needed.
2. `20261105000001_cohort_tracking.sql`: creates `cohort_snapshots`, `cohort_snapshot_rows`, `cohorts`,
   `cohort_members` and `cohort_activity_log`, with RLS on and no direct access for browser keys.
3. `20261105000002_rls_hardening.sql`: turns RLS on for every `public` table and revokes the anon role's table access.
   Run the review query at the bottom of the file afterwards.

On a **brand-new Supabase project**, also run `supabase_schema.sql` (campuses, alumni tables) first if the alumni features
are needed, then the three migrations above.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only, never expose
MASTER_USER_ID=<optional: auth user id that is always Admin>
```

Enable Google sign-in under Authentication → Providers, and add `<site-url>/auth/callback` to the redirect URLs.

## Code map

- `src/lib/cohorts/report.ts`: delta engine (pure; tests in `tests/cohort-report.test.ts`, run `npm test`)
- `src/lib/cohorts/parse-coursera.ts`, `parse-members.ts`: ExcelJS parsers
- `src/lib/cohorts/data.ts`: Supabase reads and the report builder
- `src/lib/cohorts/guard.ts`: role checks for pages, API routes and server actions
- `src/app/api/cohorts/*`: snapshot upload/delete, member upload, Excel report, member template
- `src/app/(dashboard)/cohorts/*`: UI
