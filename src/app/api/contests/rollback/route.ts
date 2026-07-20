import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient();

  // STEP 1: Parse and validate body
  let body: { subContestId?: string; requestedBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { subContestId, requestedBy } = body;
  if (!subContestId) {
    return NextResponse.json({ error: 'subContestId is required' }, { status: 400 });
  }

  // STEP 2: Check that a successful import exists for this sub_contest
  const { count: importCount } = await supabase
    .from('contest_coursera_import_log')
    .select('id', { count: 'exact', head: true })
    .eq('sub_contest_id', subContestId)
    .eq('action', 'import')
    .eq('status', 'success');

  if (!importCount || importCount === 0) {
    return NextResponse.json({ error: 'No successful import found for this sub-contest' }, { status: 404 });
  }

  // STEP 3: Delete in FK-safe order
  const { error: e1 } = await supabase
    .from('contest_coursera_computed_metrics')
    .delete()
    .eq('sub_contest_id', subContestId);
  if (e1) return NextResponse.json({ error: `Failed to delete metrics: ${e1.message}` }, { status: 500 });

  const { error: e2 } = await supabase
    .from('contest_coursera_learner_stats')
    .delete()
    .eq('sub_contest_id', subContestId);
  if (e2) return NextResponse.json({ error: `Failed to delete learner stats: ${e2.message}` }, { status: 500 });

  const { error: e3 } = await supabase
    .from('contest_coursera_snapshots')
    .delete()
    .eq('sub_contest_id', subContestId);
  if (e3) return NextResponse.json({ error: `Failed to delete snapshots: ${e3.message}` }, { status: 500 });

  const { error: e4 } = await supabase
    .from('contest_coursera_import_log')
    .delete()
    .eq('sub_contest_id', subContestId);
  if (e4) return NextResponse.json({ error: `Failed to delete import logs: ${e4.message}` }, { status: 500 });

  // STEP 4: Write rollback log
  await supabase.from('contest_coursera_import_log').insert({
    sub_contest_id: subContestId,
    action: 'rollback',
    import_type: 'contest_start', 
    status: 'success',
    imported_by: requestedBy ?? null,
  });

  revalidatePath('/contests/coursera');
  revalidatePath('/contests');

  return NextResponse.json({ success: true, message: `Rollback complete for contest` });
}
