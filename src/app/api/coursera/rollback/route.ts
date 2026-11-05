import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { denyApiUnlessAccess } from '@/lib/api-guard';


export async function DELETE(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const denied = await denyApiUnlessAccess('data_management.import_coursera', 'edit');
  if (denied) return denied;

  const supabase = createAdminClient();

  // STEP 1: Parse and validate body
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

  // STEP 2: Check that a successful import exists for this month
  const { count: importCount } = await supabase
    .from('coursera_import_log')
    .select('id', { count: 'exact', head: true })
    .eq('snapshot_month', snapshotMonth)
    .eq('action', 'import')
    .eq('status', 'success');

  if (!importCount || importCount === 0) {
    return NextResponse.json({ error: 'No successful import found for this snapshot date' }, { status: 404 });
  }

  // STEP 2b: The baseline (oldest snapshot) is permanent; every week is measured against it.
  const { data: oldest } = await supabase
    .from('coursera_computed_metrics')
    .select('month')
    .order('month', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldest?.month === snapshotMonth) {
    return NextResponse.json({ error: 'The baseline report cannot be rolled back.' }, { status: 403 });
  }

  // STEP 3: Block if a newer month exists
  const { data: newerMonth } = await supabase
    .from('coursera_snapshots')
    .select('snapshot_month')
    .gt('snapshot_month', snapshotMonth)
    .order('snapshot_month', { ascending: true })
    .limit(1)
    .single();

  if (newerMonth) {
    return NextResponse.json({
      error: `Cannot roll back ${snapshotMonth} because a newer snapshot (${newerMonth.snapshot_month}) exists. Roll back snapshots newest first.`
    }, { status: 409 });
  }

  // STEP 4: Delete in FK-safe order
  const monthFirst = snapshotMonth;

  const { error: e1 } = await supabase
    .from('coursera_computed_metrics')
    .delete()
    .eq('month', monthFirst);
  if (e1) return NextResponse.json({ error: `Failed to delete metrics: ${e1.message}` }, { status: 500 });

  const { error: e2 } = await supabase
    .from('coursera_learner_month')
    .delete()
    .eq('month', monthFirst);
  if (e2) return NextResponse.json({ error: `Failed to delete learner_month: ${e2.message}` }, { status: 500 });

  for (const table of ['coursera_specialization_snapshots', 'coursera_program_snapshots', 'coursera_clip_snapshots']) {
    const { error } = await supabase.from(table).delete().eq('snapshot_month', snapshotMonth);
    if (error) return NextResponse.json({ error: `Failed to delete ${table}: ${error.message}` }, { status: 500 });
  }

  const { error: e3 } = await supabase
    .from('coursera_snapshots')
    .delete()
    .eq('snapshot_month', snapshotMonth);
  if (e3) return NextResponse.json({ error: `Failed to delete snapshots: ${e3.message}` }, { status: 500 });

  // STEP 5: Write rollback log
  await supabase.from('coursera_import_log').insert({
    snapshot_month: snapshotMonth,
    action: 'rollback',
    status: 'success',
    imported_by: requestedBy ?? null,
  });

  // STEP 6: Return
  const monthLabel = new Date(snapshotMonth + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return NextResponse.json({ success: true, message: `Rollback complete for ${monthLabel}` });
}
