import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCohortApi } from '@/lib/cohorts/guard';
import { MAX_UPLOAD_BYTES } from '@/lib/cohorts/constants';
import { getCohort, getCohortMembers, logActivity } from '@/lib/cohorts/data';
import { parseMemberText, parseMemberWorkbook, type ParsedMemberList } from '@/lib/cohorts/parse-members';

export const runtime = 'nodejs';

/**
 * POST multipart/form-data — add people to a cohort.
 *   file   .xlsx or .csv with an Email column (optional Name, Alt Email)
 *   text   or pasted lines: "email[, alt email][, name]"
 *   mode   "add" (default) keeps existing members; "replace" removes anyone
 *          not in the new list (soft-removed, history is kept).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCohortApi('edit');
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const supabase = createAdminClient();
  const cohort = await getCohort(id, supabase);
  if (!cohort) return NextResponse.json({ error: 'Cohort not found.' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  const text = String(form.get('text') ?? '');
  const mode = form.get('mode') === 'replace' ? 'replace' : 'add';

  let parsed: ParsedMemberList;
  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is larger than 25 MB.');
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx')) parsed = await parseMemberWorkbook(await file.arrayBuffer());
      else if (name.endsWith('.csv') || name.endsWith('.txt')) parsed = parseMemberText(await file.text());
      else throw new Error('Upload an .xlsx or .csv file.');
    } else if (text.trim()) {
      parsed = parseMemberText(text);
    } else {
      throw new Error('Upload a file or paste a list of emails.');
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the list.' }, { status: 400 });
  }
  if (!parsed.members.length) {
    return NextResponse.json({ error: 'No valid email addresses found.', invalid: parsed.invalid }, { status: 400 });
  }

  const before = await getCohortMembers(id, supabase);
  const beforeByEmail = new Map(before.map(m => [m.email, m]));

  const rows = parsed.members.map(m => ({
    cohort_id: id,
    email: m.email,
    alt_email: m.alt_email ?? beforeByEmail.get(m.email)?.alt_email ?? null,
    name: m.name ?? beforeByEmail.get(m.email)?.name ?? null,
    removed_at: null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('cohort_members')
      .upsert(rows.slice(i, i + 500), { onConflict: 'cohort_id,email' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let removed = 0;
  if (mode === 'replace') {
    const keep = new Set(parsed.members.map(m => m.email));
    const toRemove = before.filter(m => !keep.has(m.email)).map(m => m.id);
    for (let i = 0; i < toRemove.length; i += 200) {
      const { error } = await supabase
        .from('cohort_members')
        .update({ removed_at: new Date().toISOString() })
        .in('id', toRemove.slice(i, i + 200));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    removed = toRemove.length;
  }

  const added = parsed.members.filter(m => !beforeByEmail.has(m.email)).length;
  const result = {
    added,
    updated: parsed.members.length - added,
    removed,
    duplicates: parsed.duplicates,
    invalid: parsed.invalid.slice(0, 50),
    invalidCount: parsed.invalid.length,
  };
  await logActivity(
    {
      action: 'members_upload',
      program: cohort.program,
      cohort_id: id,
      details: { cohort: cohort.name, mode, ...result, invalid: undefined },
      performed_by: actor.name,
    },
    supabase,
  );
  revalidatePath(`/cohorts/${id}`);
  revalidatePath('/cohorts');
  return NextResponse.json({ success: true, ...result });
}
