import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCohortApi } from '@/lib/cohorts/guard';
import { isProgram, MAX_UPLOAD_BYTES } from '@/lib/cohorts/constants';
import { parseCourseraExport, SnapshotParseError, type CourseraRow } from '@/lib/cohorts/parse-coursera';
import { logActivity } from '@/lib/cohorts/data';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Admin = ReturnType<typeof createAdminClient>;
type StoredRow = CourseraRow & { carried_forward: boolean };

/** All rows of a snapshot (paginated; PostgREST caps responses at 1000 rows). */
async function fetchSnapshotRows(supabase: Admin, snapshotId: string): Promise<StoredRow[]> {
  const out: StoredRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cohort_snapshot_rows')
      .select('email, name, course_id, course_name, university, course_type, enrollment_time, last_activity_time, overall_progress, learning_hours, completed, completion_time, course_grade, removed_from_program, carried_forward')
      .eq('snapshot_id', snapshotId)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as StoredRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * POST multipart/form-data:
 *   file          the FULL Coursera "Learner Activity" export (.xlsx)
 *   program       e.g. "Zuvy"
 *   snapshotDate  YYYY-MM-DD — the date the export was taken
 *   replace       "true" to overwrite an existing snapshot for that date
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  const actor = await requireCohortApi('edit');
  if (actor instanceof NextResponse) return actor;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 });
  }
  const file = form.get('file');
  const program = String(form.get('program') ?? '').trim();
  const snapshotDate = String(form.get('snapshotDate') ?? '').trim();
  const replace = form.get('replace') === 'true';

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!isProgram(program)) return NextResponse.json({ error: 'Unknown program.' }, { status: 400 });
  if (!ISO_DATE.test(snapshotDate) || isNaN(new Date(snapshotDate).getTime())) {
    return NextResponse.json({ error: 'Snapshot date must be a valid date (YYYY-MM-DD).' }, { status: 400 });
  }
  if (snapshotDate > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Snapshot date cannot be in the future.' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .xlsx files are supported.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is larger than 25 MB.' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = await parseCourseraExport(await file.arrayBuffer());
  } catch (e) {
    const msg = e instanceof SnapshotParseError ? e.message : 'Could not parse the file.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'The file has no learner rows.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('cohort_snapshots')
    .select('id, status')
    .eq('program', program)
    .eq('snapshot_date', snapshotDate)
    .maybeSingle();
  if (existing && existing.status === 'ready' && !replace) {
    return NextResponse.json(
      { error: `A ${program} snapshot for ${snapshotDate} already exists. Tick "replace" to overwrite it.`, code: 'exists' },
      { status: 409 },
    );
  }
  if (existing) {
    const { error } = await supabase.from('cohort_snapshots').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: snap, error: snapErr } = await supabase
    .from('cohort_snapshots')
    .insert({
      program,
      snapshot_date: snapshotDate,
      filename: file.name,
      file_size_bytes: file.size,
      status: 'processing',
      uploaded_by: actor.name,
    })
    .select('id')
    .single();
  if (snapErr || !snap) {
    return NextResponse.json({ error: snapErr?.message ?? 'Could not create snapshot.' }, { status: 500 });
  }

  try {
    // Carry forward: a learner who is in this export but is missing a course
    // they had in the previous snapshot keeps that course's last values, so a
    // later re-appearance is not counted as brand-new hours.
    const rows: StoredRow[] = parsed.rows.map(r => ({ ...r, carried_forward: false }));
    let carried = 0;
    const { data: prev } = await supabase
      .from('cohort_snapshots')
      .select('id, snapshot_date')
      .eq('program', program)
      .eq('status', 'ready')
      .lt('snapshot_date', snapshotDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev) {
      const present = new Set(rows.map(r => `${r.email}|${r.course_id}`));
      const learners = new Set(rows.map(r => r.email));
      for (const p of await fetchSnapshotRows(supabase, prev.id)) {
        if (learners.has(p.email) && !present.has(`${p.email}|${p.course_id}`)) {
          rows.push({ ...p, learning_hours: Number(p.learning_hours), carried_forward: true });
          carried++;
        }
      }
    }

    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000).map(r => ({ ...r, snapshot_id: snap.id }));
      const { error } = await supabase.from('cohort_snapshot_rows').insert(batch);
      if (error) throw new Error(`Saving rows failed: ${error.message}`);
    }

    const learnerCount = new Set(rows.map(r => r.email)).size;
    const totalHours = Math.round(rows.reduce((t, r) => t + Number(r.learning_hours), 0) * 100) / 100;
    const { error: updErr } = await supabase
      .from('cohort_snapshots')
      .update({ status: 'ready', row_count: rows.length, learner_count: learnerCount, total_hours: totalHours })
      .eq('id', snap.id);
    if (updErr) throw new Error(updErr.message);

    const summary = {
      rows: rows.length,
      learners: learnerCount,
      totalHours,
      carriedForward: carried,
      skippedRows: parsed.skippedRows,
      duplicateRows: parsed.duplicateRows,
      sheet: parsed.sheetName,
      previousSnapshot: prev?.snapshot_date ?? null,
      replaced: !!existing,
    };
    await logActivity(
      {
        action: 'snapshot_upload',
        program,
        snapshot_id: snap.id,
        details: { snapshot_date: snapshotDate, filename: file.name, ...summary },
        duration_ms: Date.now() - started,
        performed_by: actor.name,
      },
      supabase,
    );
    revalidatePath('/cohorts', 'layout');
    return NextResponse.json({ success: true, snapshotId: snap.id, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('cohort_snapshots').delete().eq('id', snap.id);
    await logActivity(
      {
        action: 'snapshot_upload',
        program,
        status: 'error',
        error_message: msg,
        details: { snapshot_date: snapshotDate, filename: file.name },
        duration_ms: Date.now() - started,
        performed_by: actor.name,
      },
      supabase,
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
