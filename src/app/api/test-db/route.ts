import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  const subContestId = 'f98e59ef-1d59-4df9-b730-80d6004c8e71';

  // 1. Get distinct groups and teams from ng_members
  const { data: members } = await supabase
    .from('ng_members')
    .select('email, full_name, team, group_name');

  const groups = [...new Set((members ?? []).map(m => m.group_name).filter(Boolean))];
  const teams = [...new Set((members ?? []).map(m => m.team).filter(Boolean))];

  // 2. Sample learner stats joined with member info
  const memberEmails = (members ?? []).map(m => m.email.toLowerCase().trim());
  
  const { data: stats } = await supabase
    .from('contest_coursera_learner_stats')
    .select('email, name, period_hours, cumulative_hours, is_active, is_compliant, courses_completed')
    .eq('sub_contest_id', subContestId)
    .in('email', memberEmails.length > 0 ? memberEmails : ['NONE'])
    .order('period_hours', { ascending: false })
    .limit(10);

  // 3. Member count per group and team
  const groupCounts: Record<string, number> = {};
  const teamCounts: Record<string, number> = {};
  for (const m of members ?? []) {
    if (m.group_name) groupCounts[m.group_name] = (groupCounts[m.group_name] ?? 0) + 1;
    if (m.team) teamCounts[m.team] = (teamCounts[m.team] ?? 0) + 1;
  }

  return NextResponse.json({
    totalMembers: members?.length ?? 0,
    groups,
    teams,
    groupCounts,
    teamCounts,
    topLearnersSample: stats?.slice(0, 5),
    memberSample: members?.slice(0, 5),
  });
}
