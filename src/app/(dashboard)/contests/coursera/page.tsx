import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/roles';
import ContestDashboardClient from './_components/ContestDashboardClient';
import { getSubContests } from '@/app/actions/contests';

interface SearchParams { contest?: string }

export default async function CourseraDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const role = await getUserRole();
  if (role === 'Member') redirect('/');

  const { contest: contestParam } = await searchParams;

  const supabase = createAdminClient();

  // 1. Get all sub-contests
  const subContests = await getSubContests();
  const targetContestId = contestParam ?? subContests?.[0]?.id ?? null;

  const availableContests = subContests.map((sc: any) => ({
    id: sc.id,
    label: sc.contest_series?.name ? `${sc.contest_series.name} - ${sc.name}` : sc.name,
  }));

  const contestLabel = availableContests.find(c => c.id === targetContestId)?.label ?? 'Contest';
  
  const targetContestObj = subContests.find((c: any) => c.id === targetContestId);
  const startDate = targetContestObj?.start_date;
  const endDate = targetContestObj?.end_date;
  const seriesName = targetContestObj?.contest_series?.name ?? '';
  const subContestName = targetContestObj?.name ?? 'Contest';

  // 2. Fetch config
  const { data: config } = await supabase
    .from('contest_coursera_config')
    .select('minimum_monthly_hours')
    .eq('id', 1)
    .single();
  const minHours = config?.minimum_monthly_hours ?? 20;

  // 3. Fetch all learner stats (paginated to bypass 1000 limit)
  let allLearnerStats: any[] = [];
  if (targetContestId) {
    let from = 0;
    const step = 1000;
    while (true) {
      const { data } = await supabase
        .from('contest_coursera_learner_stats')
        .select('*')
        .eq('sub_contest_id', targetContestId)
        .range(from, from + step - 1);
      if (!data || data.length === 0) break;
      allLearnerStats.push(...data);
      if (data.length < step) break;
      from += step;
    }
  }

  // 4. Fetch ng_members with group_name and team
  const { data: members } = await supabase
    .from('ng_members')
    .select('email, alt_email, full_name, team, group_name');

  // 5. Join: Map all ng_members and enrich with their learner stats (if any)
  const statsMap = new Map<string, any>();
  for (const s of allLearnerStats ?? []) {
    statsMap.set(s.email.toLowerCase().trim(), s);
  }

  const enrichedStats = (members ?? []).map(m => {
    const email = m.email.toLowerCase().trim();
    const altEmail = m.alt_email?.toLowerCase().trim();
    
    const sMain = statsMap.get(email);
    const sAlt = altEmail ? statsMap.get(altEmail) : null;
    
    const period_hours = (sMain ? Number(sMain.period_hours) : 0) + (sAlt ? Number(sAlt.period_hours) : 0);
    const cumulative_hours = (sMain ? Number(sMain.cumulative_hours) : 0) + (sAlt ? Number(sAlt.cumulative_hours) : 0);
    const courses_enrolled = (sMain ? Number(sMain.courses_enrolled) : 0) + (sAlt ? Number(sAlt.courses_enrolled) : 0);
    const courses_completed = (sMain ? Number(sMain.courses_completed) : 0) + (sAlt ? Number(sAlt.courses_completed) : 0);
    const new_completions = (sMain ? Number(sMain.new_completions) : 0) + (sAlt ? Number(sAlt.new_completions) : 0);
    const is_active = (sMain?.is_active || sAlt?.is_active) ?? false;
    const is_compliant = (sMain?.is_compliant || sAlt?.is_compliant) ?? false;
    
    let days_since_activity = null;
    if (sMain?.days_since_activity != null && sAlt?.days_since_activity != null) {
      days_since_activity = Math.min(sMain.days_since_activity, sAlt.days_since_activity);
    } else {
      days_since_activity = sMain?.days_since_activity ?? sAlt?.days_since_activity ?? null;
    }
    
    return {
      email: email,
      name: m.full_name || sMain?.name || sAlt?.name || null,
      period_hours,
      cumulative_hours,
      courses_enrolled,
      courses_completed,
      new_completions,
      is_active,
      is_compliant,
      days_since_activity,
      group_name: m.group_name ?? null,
      team: m.team ?? null,
    };
  });

  // 6. Extract distinct groups and teams
  const groups = [...new Set(enrichedStats.map(s => s.group_name).filter(Boolean))] as string[];
  groups.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const teams = [...new Set(enrichedStats.map(s => s.team).filter(Boolean))] as string[];
  teams.sort();

  // 7. Get generated_at
  const { data: metricsRow } = targetContestId
    ? await supabase
        .from('contest_coursera_computed_metrics')
        .select('generated_at')
        .eq('sub_contest_id', targetContestId)
        .single()
    : { data: null };

  // Empty state
  if (enrichedStats.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="p-4 rounded-2xl bg-muted/50 border border-border/60">
          <svg className="w-12 h-12 mx-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">No data available for this Contest</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Import your Coursera report and ensure members are added to the Members list to see contest analytics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/settings/members"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border/80 font-semibold text-sm hover:bg-accent transition"
            >
              Manage Members
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
    <ContestDashboardClient
      stats={enrichedStats}
      groups={groups}
      teams={teams}
      contestLabel={contestLabel}
      generatedAt={metricsRow?.generated_at ?? new Date().toISOString()}
      selectedContestId={targetContestId!}
      availableContests={availableContests}
      importHref="/contests/coursera/import-reports"
      activityHref={`/contests/coursera/activity-logs?contest=${targetContestId}`}
      minHours={minHours}
      startDate={startDate}
      endDate={endDate}
      seriesName={seriesName}
      subContestName={subContestName}
    />
  );
}
