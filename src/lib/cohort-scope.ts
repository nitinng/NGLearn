import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeMetricsBlob,
  normaliseLearnerRecord,
  type LearnerMonthRecord,
} from '@/lib/coursera-metrics';
import { makePeriodLabeler } from '@/lib/report-periods';

/**
 * Everything users see is limited to cohort members. Full weekly reports are
 * stored; these helpers read through the cohort views:
 *   - cohort_learner_month  (one cohort: filter by cohort_id)
 *   - tracked_learner_month (all cohorts: anyone in at least one cohort)
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface CohortOption {
  id: string;
  name: string;
  member_count: number;
}

export const ALL_COHORTS = 'all';

export async function listCohortOptions(supabase: Admin = createAdminClient()): Promise<CohortOption[]> {
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, name, cohort_members(count)')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ cohort_members, ...c }) => ({
    ...c,
    member_count: (cohort_members as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

/** Returns the cohort id, or null for "all cohorts". Unknown ids fall back to all. */
export function resolveCohort(param: string | undefined | null, cohorts: CohortOption[]): string | null {
  if (!param || param === ALL_COHORTS) return null;
  return cohorts.some(c => c.id === param) ? param : null;
}

/** Query builder over the right view for the scope. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopedLearnerQuery(supabase: Admin, cohortId: string | null, columns = '*', opts?: { count?: 'exact' }): any {
  return cohortId
    ? supabase.from('cohort_learner_month').select(columns, opts).eq('cohort_id', cohortId)
    : supabase.from('tracked_learner_month').select(columns, opts);
}

export async function scopeMemberCount(supabase: Admin, cohortId: string | null): Promise<number> {
  if (cohortId) {
    const { count } = await supabase.from('cohort_members').select('id', { count: 'exact', head: true }).eq('cohort_id', cohortId);
    return count ?? 0;
  }
  // Distinct people across all cohorts
  const emails = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('cohort_members').select('email').order('id').range(from, from + 999);
    for (const r of data ?? []) emails.add(r.email);
    if (!data || data.length < 1000) break;
  }
  return emails.size;
}

async function fetchScopedRecords(supabase: Admin, cohortId: string | null, months: string[]) {
  const rows: (LearnerMonthRecord & { month: string; full_name: string | null })[] = [];
  if (!months.length) return rows;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await scopedLearnerQuery(supabase, cohortId)
      .in('month', months)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const rec = normaliseLearnerRecord(r);
      rows.push({ ...rec, name: r.full_name ?? r.name });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function getMetricsConfig(supabase: Admin) {
  const { data } = await supabase
    .from('coursera_config')
    .select('minimum_monthly_hours, inactive_after_days, total_licenses')
    .eq('id', 1)
    .maybeSingle();
  return {
    minMonthlyHours: Number(data?.minimum_monthly_hours ?? 5),
    inactiveAfterDays: Number(data?.inactive_after_days ?? 90),
    // Seat utilisation is an organisation-wide number; it is not meaningful per cohort.
    totalLicenses: 0,
  };
}

export interface ScopedDashboard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: Record<string, any>;
  trend: { month: string; active_learners: number; monthly_hours: number; monthly_completions: number; license_utilization_pct: null }[];
  memberCount: number;
}

/**
 * Dashboard numbers for one snapshot, limited to the cohort scope.
 * `snapshotsDesc` = all snapshot dates, newest first.
 */
export async function buildScopedDashboard(
  cohortId: string | null,
  month: string,
  snapshotsDesc: string[],
  trendLength = 6,
): Promise<ScopedDashboard> {
  const supabase = createAdminClient();
  const idx = snapshotsDesc.indexOf(month);
  const prevMonth = idx >= 0 ? snapshotsDesc[idx + 1] ?? null : null;
  const trendMonths = snapshotsDesc.slice(Math.max(0, idx), Math.max(0, idx) + trendLength);
  const months = [...new Set([month, ...(prevMonth ? [prevMonth] : []), ...trendMonths])];

  const [config, rows, memberCount] = await Promise.all([
    getMetricsConfig(supabase),
    fetchScopedRecords(supabase, cohortId, months),
    scopeMemberCount(supabase, cohortId),
  ]);

  // A person in two cohorts appears twice in the "all cohorts" view only if
  // that view is joined; tracked_learner_month has one row per learner, but
  // de-duplicate defensively.
  const byMonth = new Map<string, Map<string, (typeof rows)[number]>>();
  for (const r of rows) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, new Map());
    byMonth.get(r.month)!.set(r.email, r);
  }
  const current = [...(byMonth.get(month)?.values() ?? [])];
  const previous = prevMonth ? [...(byMonth.get(prevMonth)?.values() ?? [])] : [];

  // A merged multi-week period needs the weekly target once per week.
  const weeksCovered = Math.max(1, makePeriodLabeler(snapshotsDesc)(month).weeks);
  const metrics = {
    ...computeMetricsBlob(current, previous, { ...config, minMonthlyHours: config.minMonthlyHours * weeksCovered }, month),
    weeks_covered: weeksCovered,
    cohort_members_total: memberCount,
    cohort_members_not_found: Math.max(0, memberCount - current.length),
  };

  const trend = [...trendMonths].reverse().map(m => {
    const recs = [...(byMonth.get(m)?.values() ?? [])];
    return {
      month: m,
      active_learners: recs.filter(r => r.is_active).length,
      monthly_hours: recs.reduce((t, r) => t + r.monthly_hours, 0),
      monthly_completions: recs.reduce((t, r) => t + r.new_completions, 0),
      license_utilization_pct: null,
    };
  });

  return { metrics, trend, memberCount };
}

/** True when the email belongs to at least one cohort. */
export async function isCohortMember(email: string, supabase: Admin = createAdminClient()): Promise<boolean> {
  const { count } = await supabase
    .from('cohort_members')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.trim().toLowerCase());
  return (count ?? 0) > 0;
}
