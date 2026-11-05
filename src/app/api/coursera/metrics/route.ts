import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { buildScopedDashboard, listCohortOptions, resolveCohort } from '@/lib/cohort-scope';

/**
 * GET ?month=YYYY-MM-DD[&cohort=<id>|all]
 * Dashboard metrics for one snapshot, limited to cohort members
 * (one cohort, or everyone in any cohort).
 */
export async function GET(request: NextRequest) {
  const denied = await denyApiUnlessAccess('data_management.coursera');
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required in YYYY-MM-DD format' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: monthsList, error }, cohorts] = await Promise.all([
    supabase.from('coursera_computed_metrics').select('month').order('month', { ascending: false }),
    listCohortOptions(supabase),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const months = (monthsList ?? []).map(m => m.month as string);
  if (!months.includes(month)) {
    return NextResponse.json({ error: 'No snapshot for this date' }, { status: 404 });
  }

  const cohortId = resolveCohort(searchParams.get('cohort'), cohorts);
  const { metrics } = await buildScopedDashboard(cohortId, month, months, 1);
  return NextResponse.json({ month, cohort: cohortId ?? 'all', metrics });
}
