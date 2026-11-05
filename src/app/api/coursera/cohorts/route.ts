import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { getSignedInUser } from '@/lib/access';
import { MAX_COHORT_MEMBERS, normaliseMembers } from '@/lib/cohorts/parse-cohort-workbook';

export const runtime = 'nodejs';

/** GET: all cohorts with member counts (newest first). */
export async function GET() {
  const denied = await denyApiUnlessAccess('data_management.cohorts', 'view');
  if (denied) return denied;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, name, description, created_by, created_at, cohort_members(count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    cohorts: (data ?? []).map(({ cohort_members, ...c }) => ({
      ...c,
      member_count: (cohort_members as { count: number }[] | null)?.[0]?.count ?? 0,
    })),
  });
}

/**
 * POST { name, members: [{ full_name, email }], replace?: boolean }
 * Creates a cohort. If a cohort with that name exists, `replace: true`
 * swaps its member list for the new one; otherwise 409.
 */
export async function POST(request: NextRequest) {
  const denied = await denyApiUnlessAccess('data_management.cohorts', 'edit');
  if (denied) return denied;
  const user = await getSignedInUser();

  let body: { name?: string; description?: string; members?: { full_name?: string | null; email?: string | null }[]; replace?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Give the cohort a name.' }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: 'Cohort name is too long.' }, { status: 400 });

  const { members, invalidRows, duplicateRows } = normaliseMembers(body.members ?? []);
  if (members.length === 0) return NextResponse.json({ error: 'No valid email addresses in the list.' }, { status: 400 });
  if (members.length > MAX_COHORT_MEMBERS) {
    return NextResponse.json({ error: `A cohort can have at most ${MAX_COHORT_MEMBERS} members.` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const createdBy = (user?.user_metadata?.full_name as string | undefined) || user?.email || null;

  const { data: existing } = await supabase
    .from('cohorts')
    .select('id')
    .ilike('name', name.replace(/[%_\\]/g, (c) => `\\${c}`))
    .maybeSingle();
  let cohortId: string;
  if (existing) {
    if (!body.replace) {
      return NextResponse.json({ error: `A cohort called "${name}" already exists.`, code: 'exists' }, { status: 409 });
    }
    cohortId = existing.id;
    const { error } = await supabase.from('cohort_members').delete().eq('cohort_id', cohortId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await supabase
      .from('cohorts')
      .insert({ name, description: body.description?.trim() || null, created_by: createdBy })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not create cohort.' }, { status: 500 });
    cohortId = data.id;
  }

  for (let i = 0; i < members.length; i += 500) {
    const { error } = await supabase
      .from('cohort_members')
      .insert(members.slice(i, i + 500).map(m => ({ ...m, cohort_id: cohortId })));
    if (error) {
      if (!existing) await supabase.from('cohorts').delete().eq('id', cohortId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    cohortId,
    replaced: !!existing,
    members: members.length,
    invalidRows,
    duplicateRows,
  });
}
