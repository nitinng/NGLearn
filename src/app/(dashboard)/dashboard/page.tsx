import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyUnlessAccess } from '@/lib/guard';
import { buildScopedDashboard, listCohortOptions, resolveCohort } from '@/lib/cohort-scope';
import { CohortPicker } from '@/components/cohort-picker';
import CourseraDashboardClient from './_components/CourseraDashboardClient';

export const dynamic = 'force-dynamic';

interface SearchParams { month?: string; cohort?: string; view?: string }

export default async function CourseraDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const denied = await denyUnlessAccess('data_management.coursera', 'view', { backHref: '/', backLabel: 'Back to home' });
  if (denied) return denied;

  const { month: monthParam, cohort: cohortParam, view } = await searchParams;
  const viewAll = view === 'all';
  const supabase = createAdminClient(); // reads run after the access check above

  const [{ data: monthsList }, cohorts] = await Promise.all([
    supabase.from('coursera_computed_metrics').select('month, generated_at').order('month', { ascending: false }),
    listCohortOptions(supabase),
  ]);
  const months = (monthsList ?? []).map(m => m.month as string);

  if (cohorts.length === 0 || months.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-xl font-bold">
          {cohorts.length === 0 ? 'No cohorts yet' : 'No Coursera data imported yet'}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The dashboard only shows learners who belong to a cohort.{' '}
          {cohorts.length === 0
            ? 'Import a cohort list (Full Name + email) on the Export page first.'
            : 'Upload the weekly Coursera export to start.'}
        </p>
        <Link
          href={cohorts.length === 0 ? '/export' : '/import-reports'}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {cohorts.length === 0 ? 'Import a cohort →' : 'Import a weekly report →'}
        </Link>
      </div>
    );
  }

  const cohortId = resolveCohort(cohortParam, cohorts);
  // "All time" = lifetime totals as of the latest upload.
  const targetMonth = !viewAll && monthParam && months.includes(monthParam) ? monthParam : months[0];
  const { metrics, trend } = await buildScopedDashboard(cohortId, targetMonth, months);
  const generatedAt = (monthsList ?? []).find(m => m.month === targetMonth)?.generated_at ?? new Date().toISOString();
  const scopeLabel = cohortId ? cohorts.find(c => c.id === cohortId)!.name : 'All cohorts';

  return (
    <CourseraDashboardClient
      metrics={metrics}
      trend={trend}
      selectedMonth={targetMonth}
      availableMonths={months}
      generatedAt={generatedAt}
      scopeLabel={scopeLabel}
      viewAll={viewAll}
      extraQuery={cohortId ? `cohort=${cohortId}` : undefined}
      scopeBar={
        <CohortPicker
          cohorts={cohorts}
          selected={cohortId}
          hrefFor={id => `/dashboard?${viewAll ? 'view=all' : `month=${targetMonth}`}${id === 'all' ? '' : `&cohort=${id}`}`}
        />
      }
    />
  );
}
