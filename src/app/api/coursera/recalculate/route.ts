import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { computeMetricsBlob } from '@/lib/coursera-metrics';

// Weekly snapshots: `month` holds the exact snapshot date.
const periodKey = (s: string) => s;
const ACTIVE_WINDOW_DAYS = 7;

async function upsertInBatches<T extends object>(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 500
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Batch upsert failed on ${table}: ${error.message}`);
  }
}

async function fetchAllSupabase(queryBuilder: any) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const denied = await denyApiUnlessAccess('data_management.import_coursera', 'edit');
  if (denied) return denied;

  const supabase = createAdminClient();

  let body: { snapshotMonth?: string; requestedBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { snapshotMonth, requestedBy } = body;
  if (!snapshotMonth || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotMonth)) {
    return NextResponse.json({ error: 'snapshotMonth must be in YYYY-MM-DD format' }, { status: 400 });
  }

  // STEP 1: Verify snapshots exist
  const { count: snapCount } = await supabase
    .from('coursera_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('snapshot_month', snapshotMonth);

  if (!snapCount || snapCount === 0) {
    return NextResponse.json({ error: `No snapshots found for month ${snapshotMonth}` }, { status: 404 });
  }

  // STEP 2: Fetch all snapshots for this month
  const snapshots = await fetchAllSupabase(
    supabase.from('coursera_snapshots').select('*').eq('snapshot_month', snapshotMonth)
  );

  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ error: `Failed to fetch snapshots or none found` }, { status: 500 });
  }

  // STEP 3: Re-run Steps 5–8 of the import algorithm

  // Fetch config
  const { data: config } = await supabase
    .from('coursera_config')
    .select('minimum_monthly_hours, inactive_after_days, total_licenses')
    .eq('id', 1)
    .single();

  const minMonthlyHours = config?.minimum_monthly_hours ?? 5;
  const totalLicenses = config?.total_licenses ?? 0;

  // Find previous snapshot month
  const { data: prevMonthRow } = await supabase
    .from('coursera_snapshots')
    .select('snapshot_month')
    .lt('snapshot_month', snapshotMonth)
    .order('snapshot_month', { ascending: false })
    .limit(1)
    .single();

  const prevMonth: string | null = prevMonthRow?.snapshot_month ?? null;
  // Weeks this snapshot covers (merged periods need the weekly target once per week).
  const weekGap = prevMonth
    ? Math.round((Date.parse(`${snapshotMonth}T00:00:00Z`) - Date.parse(`${prevMonth}T00:00:00Z`)) / (7 * 86400000))
    : 1;
  const periodWeekCount = Math.max(1, weekGap);

  // Fetch prev month totals via coursera_learner_month
  type PrevTotals = { email: string; prev_hours: number; prev_completions: number };
  const prevMap = new Map<string, PrevTotals>();
  let prevRecords: any[] = [];
  if (prevMonth) {
    prevRecords = await fetchAllSupabase(
      supabase.from('coursera_learner_month').select('*').eq('month', prevMonth)
    );
    for (const row of prevRecords) {
      prevMap.set(row.email, { email: row.email, prev_hours: Number(row.cumulative_hours), prev_completions: Number(row.courses_completed) });
    }
  }

  // Group by email in JS
  const byEmail = new Map<string, typeof snapshots>();
  for (const row of snapshots) {
    if (!byEmail.has(row.email)) byEmail.set(row.email, []);
    byEmail.get(row.email)!.push(row);
  }


  const learnerMonthRecords = Array.from(byEmail.entries()).map(([email, rows]) => {
    const prev = prevMap.get(email) ?? { prev_hours: 0, prev_completions: 0 };

    const cumulative_hours = rows.reduce((s, r) => s + (r.cumulative_learning_hours ?? 0), 0);
    const monthly_hours = Math.max(0, cumulative_hours - prev.prev_hours);
    const courses_enrolled = rows.length;
    const courses_completed = rows.filter(r => r.completed).length;
    const new_completions = Math.max(0, courses_completed - prev.prev_completions);
    const avg_progress = rows.reduce((s, r) => s + (r.overall_progress ?? 0), 0) / rows.length;
    const is_active = monthly_hours > 0;

    const windowStart = new Date(snapshotMonth + 'T23:59:59Z').getTime() - ACTIVE_WINDOW_DAYS * 86400000;
    const courses_active = rows.filter(r =>
      r.last_activity_time && new Date(r.last_activity_time).getTime() > windowStart
    ).length;

    const activityTimes = rows
      .filter(r => r.last_activity_time)
      .map(r => new Date(r.last_activity_time).getTime())
      .sort((a, b) => b - a);

    const latestActivity = activityTimes[0] ?? null;
    const days_since_activity = latestActivity !== null
      ? Math.max(0, Math.floor((Date.now() - latestActivity) / 86400000))
      : null;

    const is_compliant = monthly_hours >= minMonthlyHours * periodWeekCount;

    return {
      month: periodKey(snapshotMonth),
      email,
      name: rows[0].name,
      monthly_hours,
      cumulative_hours,
      courses_enrolled,
      courses_active,
      courses_completed,
      new_completions,
      avg_progress,
      is_active,
      is_compliant,
      days_since_activity,
    };
  });

  try {
    await upsertInBatches(supabase, 'coursera_learner_month', learnerMonthRecords, 'month,email');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // We already fetched prevRecords earlier. Just build the map for MoM deltas:
  const metricsBlob = computeMetricsBlob(
    learnerMonthRecords,
    prevRecords,
    { minMonthlyHours, inactiveAfterDays: config?.inactive_after_days ?? 90, totalLicenses },
    snapshotMonth,
  );


  const { error: metricsErr } = await supabase
    .from('coursera_computed_metrics')
    .upsert({
      month: periodKey(snapshotMonth),
      metrics: metricsBlob,
      generated_by: requestedBy ?? null,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'month' });

  if (metricsErr) {
    return NextResponse.json({ error: `Failed to save metrics: ${metricsErr.message}` }, { status: 500 });
  }

  await supabase.from('coursera_import_log').insert({
    snapshot_month: snapshotMonth,
    action: 'recalculate',
    status: 'success',
    duration_ms: Date.now() - startTime,
    imported_by: requestedBy ?? null,
  });

  return NextResponse.json({
    success: true,
    month: periodKey(snapshotMonth),
    durationMs: Date.now() - startTime,
  });
}
