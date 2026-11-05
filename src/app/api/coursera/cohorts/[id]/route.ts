import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyApiUnlessAccess } from '@/lib/api-guard';

export const runtime = 'nodejs';

/** GET: the cohort and its members. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyApiUnlessAccess('data_management.cohorts', 'view');
  if (denied) return denied;
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', id).maybeSingle();
  if (!cohort) return NextResponse.json({ error: 'Cohort not found.' }, { status: 404 });

  const members: { full_name: string | null; email: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cohort_members')
      .select('full_name, email')
      .eq('cohort_id', id)
      .order('full_name', { nullsFirst: false })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    members.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ cohort, members });
}

/** DELETE: removes the cohort and its member list (Coursera data is untouched). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyApiUnlessAccess('data_management.cohorts', 'edit');
  if (denied) return denied;
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.from('cohorts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
