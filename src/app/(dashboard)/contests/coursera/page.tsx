import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/roles';
import CourseraDashboardClient from '@/app/(dashboard)/data-management/coursera/_components/CourseraDashboardClient';
import { getSubContests } from '@/app/actions/contests';

interface SearchParams { contest?: string }

export default async function CourseraDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const role = await getUserRole();
  if (role !== 'Super Admin' && role !== 'Admin') redirect('/');

  const { contest: contestParam } = await searchParams;

  const supabase = await createClient();

  // 1. Get all sub-contests
  const subContests = await getSubContests();

  const targetContestId = contestParam ?? subContests?.[0]?.id ?? null;
  const targetContestName = subContests.find(sc => sc.id === targetContestId)?.name || '';

  // Create labels map for the UI
  const labelsMap = subContests.reduce((acc, sc: any) => {
    acc[sc.id] = sc.contest_series?.name ? `${sc.contest_series.name} - ${sc.name}` : sc.name;
    return acc;
  }, {} as Record<string, string>);

  // 2. Fetch metrics blob for selected sub-contest
  const { data: metricsRow } = targetContestId
    ? await supabase
        .from('contest_coursera_computed_metrics')
        .select('sub_contest_id, metrics, generated_at, generated_by')
        .eq('sub_contest_id', targetContestId)
        .single()
    : { data: null };

  // 3. For contests, the "trend" chart might need to span across multiple sub-contests
  // But for now, we'll just pull the available sub-contest metrics ordered by creation
  const { data: trendRaw } = await supabase
    .from('contest_coursera_computed_metrics')
    .select(`
      sub_contest_id, 
      metrics,
      sub_contests ( name, created_at )
    `)
    .limit(6);

  const trend = (trendRaw ?? []).sort((a: any, b: any) => new Date(a.sub_contests?.created_at).getTime() - new Date(b.sub_contests?.created_at).getTime()).map(r => ({
    month: (r.sub_contests as any)?.name || r.sub_contest_id, // We map the contest name to 'month' prop in the chart
    active_learners: r.metrics?.active_learners ?? 0,
    monthly_hours: r.metrics?.period_hours ?? r.metrics?.monthly_hours ?? 0,
    monthly_completions: r.metrics?.period_completions ?? r.metrics?.monthly_completions ?? 0,
    license_utilization_pct: r.metrics?.license_utilization_pct ?? null,
  }));

  // Empty state — no imports yet
  if (!metricsRow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="p-4 rounded-2xl bg-muted/50 border border-border/60">
          <svg className="w-12 h-12 mx-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">No data imported for this Contest</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Upload your Coursera report for a specific contest to start seeing analytics, learner activity, and compliance metrics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/contests/coursera/user-list"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border/80 font-semibold text-sm hover:bg-accent transition"
            >
              Manage Contests
            </Link>
            <Link
              href="/contests/coursera/import-reports"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
            >
              Import Data →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CourseraDashboardClient
      metrics={metricsRow.metrics}
      trend={trend}
      selectedMonth={targetContestId!} // We use targetContestId as 'month'
      availableMonths={subContests.map(sc => sc.id)}
      availableMonthLabels={labelsMap}
      basePath="/contests/coursera"
      queryParam="contest"
      generatedAt={metricsRow.generated_at}
    />
  );
}
