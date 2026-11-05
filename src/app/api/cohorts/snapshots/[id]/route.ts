import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCohortApi } from '@/lib/cohorts/guard';
import { logActivity } from '@/lib/cohorts/data';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCohortApi('edit');
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: snap } = await supabase
    .from('cohort_snapshots')
    .select('id, program, snapshot_date, filename, row_count')
    .eq('id', id)
    .maybeSingle();
  if (!snap) return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 });

  const { error } = await supabase.from('cohort_snapshots').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(
    {
      action: 'snapshot_delete',
      program: snap.program,
      details: { snapshot_date: snap.snapshot_date, filename: snap.filename, rows: snap.row_count },
      performed_by: actor.name,
    },
    supabase,
  );
  revalidatePath('/cohorts', 'layout');
  return NextResponse.json({ success: true });
}
