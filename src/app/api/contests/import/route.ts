import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
}

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // ── STEP 0: Validate inputs ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const subContestId = (formData.get('subContestId') as string | null)?.trim();
  const importType = (formData.get('importType') as string | null)?.trim() || 'contest_start';
  const uploadedBy = (formData.get('uploadedBy') as string | null)?.trim() || null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!subContestId) return NextResponse.json({ error: 'subContestId is required' }, { status: 400 });
  if (!['contest_start', 'contest_end'].includes(importType)) {
    return NextResponse.json({ error: 'importType must be "contest_start" or "contest_end"' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 });
  }

  // Verify sub-contest exists
  const { data: subContest, error: subErr } = await supabase
    .from('sub_contests')
    .select('id, name, series_id, user_list_id')
    .eq('id', subContestId)
    .single();

  if (subErr || !subContest) {
    return NextResponse.json({ error: 'Sub-contest not found' }, { status: 404 });
  }

  // Check for duplicate import of same type for same sub-contest
  const { data: existingLogs } = await supabase
    .from('contest_coursera_import_log')
    .select('action, status, import_type')
    .eq('sub_contest_id', subContestId)
    .eq('import_type', importType)
    .eq('status', 'success')
    .order('imported_at', { ascending: false })
    .limit(1);

  if (existingLogs && existingLogs.length > 0 && existingLogs[0].action !== 'rollback') {
    return NextResponse.json({
      error: `A "${importType === 'contest_start' ? 'Contest Start' : 'Contest End'}" import already exists for this sub-contest. Use rollback first to re-import.`
    }, { status: 409 });
  }

  // ── STEP 1: Parse the XLSX file ──────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    return NextResponse.json({ error: 'Failed to parse XLSX file' }, { status: 400 });
  }

  const sheetName =
    workbook.SheetNames.includes('Learner Activity') ? 'Learner Activity' :
    workbook.SheetNames.includes('Course Activity') ? 'Course Activity' : null;

  if (!sheetName) {
    return NextResponse.json({
      error: `No recognised sheet found. Sheets in file: ${workbook.SheetNames.join(', ')}`
    }, { status: 400 });
  }

  const sheet = workbook.Sheets[sheetName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const totalRows = rawRows.length;

  // ── STEP 2: Validate columns ─────────────────────────────────────────────
  const REQUIRED_COLS = ['Email', 'Name', 'Course ID', 'Course', 'Learning Hours', 'Overall Progress', 'Completed'];
  if (rawRows.length > 0) {
    const firstRow = rawRows[0];
    const missing = REQUIRED_COLS.filter(c => !(c in firstRow));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missing.join(', ')}` }, { status: 400 });
    }
  }

  const validRows = rawRows.filter(r => r['Email'] && r['Course ID']);
  const skippedRows = totalRows - validRows.length;

  // ── STEP 3: Transform rows ───────────────────────────────────────────────
  const transformedRows = validRows.map(row => ({
    sub_contest_id:            subContestId,
    import_type:               importType,
    email:                     row['Email'].toString().trim().toLowerCase(),
    name:                      row['Name']?.toString().trim() || null,
    course_id:                 row['Course ID']?.toString().trim(),
    course_name:               row['Course']?.toString().trim() || null,
    course_slug:               row['Course Slug']?.toString().trim() || null,
    university:                row['University']?.toString().trim() || null,
    course_type:               row['Course Type']?.toString().trim() || null,
    program_name:              row['Program Name']?.toString().trim() || null,
    enrollment_time:           parseDate(row['Enrollment Time']),
    last_activity_time:        parseDate(row['Last Course Activity Time']),
    overall_progress:          parseFloat(row['Overall Progress']) || 0,
    cumulative_learning_hours: parseFloat(row['Learning Hours']) || 0,
    completed:                 row['Completed']?.toString().trim() === 'Yes',
    removed_from_program:      row['Removed From Program']?.toString().trim() === 'Yes',
    completion_time:           parseDate(row['Completion Time']),
    course_grade:              row['Course Grade'] != null ? parseFloat(row['Course Grade']) : null,
  }));

  // Deduplicate by (email, course_id) — keep highest hours
  const seen = new Map<string, typeof transformedRows[0]>();
  for (const row of transformedRows) {
    const key = `${row.email}|${row.course_id}`;
    const existing = seen.get(key);
    if (!existing || row.cumulative_learning_hours > existing.cumulative_learning_hours) {
      seen.set(key, row);
    }
  }
  const finalRows = Array.from(seen.values());

  // ── STEP 4: Upsert snapshots keyed by (sub_contest_id, email, course_id, import_type) ─
  // Start and end snapshots coexist in the same table without overwriting each other.
  try {
    await upsertInBatches(supabase, 'contest_coursera_snapshots', finalRows, 'sub_contest_id,email,course_id,import_type');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('contest_coursera_import_log').insert({
      sub_contest_id: subContestId,
      filename: file.name,
      file_size_bytes: file.size,
      rows_imported: 0,
      learners_affected: 0,
      action: 'import',
      import_type: importType,
      status: 'error',
      error_message: msg,
      duration_ms: Date.now() - startTime,
      imported_by: uploadedBy,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── STEP 5: Compute delta metrics (only when we have BOTH start and end) ─
  let metricsBlob: Record<string, unknown> | null = null;
  let learnersAffected = finalRows.length;

  // Get config
  const { data: config } = await supabase
    .from('contest_coursera_config')
    .select('minimum_monthly_hours, inactive_after_days, total_licenses')
    .eq('id', 1)
    .single();

  const minMonthlyHours = config?.minimum_monthly_hours ?? 20;

  const byEmail = new Map<string, typeof finalRows>();
  for (const row of finalRows) {
    if (!byEmail.has(row.email)) byEmail.set(row.email, []);
    byEmail.get(row.email)!.push(row);
  }
  // Update to actual unique learner count (byEmail built above)
  learnersAffected = byEmail.size;

  if (importType === 'contest_end') {
    // ── Fetch ALL start snapshots (paginated — Supabase default cap is 1000 rows) ──
    // Without pagination, large imports (15k+ rows) would only use the first 1000
    // start rows as baseline, causing most learners to have period = full cumulative hours.
    const allStartSnapshots: Array<{
      email: string; name: string; course_id: string;
      cumulative_learning_hours: number; completed: boolean;
      overall_progress: number; last_activity_time: string | null;
    }> = [];
    {
      let from = 0;
      const step = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from('contest_coursera_snapshots')
          .select('email, name, course_id, cumulative_learning_hours, completed, overall_progress, last_activity_time')
          .eq('sub_contest_id', subContestId)
          .eq('import_type', 'contest_start')
          .range(from, from + step - 1);
        if (!batch || batch.length === 0) break;
        allStartSnapshots.push(...batch);
        if (batch.length < step) break;
        from += step;
      }
    }
    const startSnapshots = allStartSnapshots;


    // Group start snapshots by email → course_id
    const startByEmail = new Map<string, Map<string, { hours: number; completed: boolean; progress: number; activity: string | null }>>();
    for (const row of startSnapshots ?? []) {
      if (!startByEmail.has(row.email)) startByEmail.set(row.email, new Map());
      startByEmail.get(row.email)!.set(row.course_id, {
        hours: Number(row.cumulative_learning_hours),
        completed: row.completed,
        progress: Number(row.overall_progress),
        activity: row.last_activity_time ?? null,
      });
    }

    const allEmails = new Set([...byEmail.keys(), ...startByEmail.keys()]);
    learnersAffected = allEmails.size;

    const learnerStatsRecords = Array.from(allEmails).map(email => {
      const endRows = byEmail.get(email) ?? [];
      const startCourseMap = startByEmail.get(email) ?? new Map();

      const name = endRows[0]?.name ?? startSnapshots?.find(r => r.email === email)?.name ?? null;

      const endCourseMap = new Map(endRows.map(r => [r.course_id, r]));
      const allCourseIds = new Set([...endCourseMap.keys(), ...startCourseMap.keys()]);

      let cumulative_hours = 0;
      let period_hours = 0;
      let courses_completed = 0;
      let new_completions = 0;
      let overall_progress_sum = 0;
      let courses_active = 0;
      const last_activity_times: number[] = [];

      for (const cid of allCourseIds) {
        const start = startCourseMap.get(cid);
        const end = endCourseMap.get(cid);

        const startHrs  = start?.hours    ?? 0;
        const endHrs    = end   ? Number(end.cumulative_learning_hours) : startHrs;
        const startComp = start?.completed ?? false;
        const endComp   = end   ? end.completed   : startComp;
        const endProg   = end   ? Number(end.overall_progress) : (start?.progress ?? 0);

        cumulative_hours     += endHrs;
        period_hours         += Math.max(0, endHrs - startHrs);
        if (endComp) courses_completed++;
        if (endComp && !startComp) new_completions++;
        overall_progress_sum += endProg;

        if (end?.last_activity_time) {
          courses_active++;
          last_activity_times.push(new Date(end.last_activity_time).getTime());
        } else if (start?.activity) {
          last_activity_times.push(new Date(start.activity).getTime());
        }
      }

      const courses_enrolled = allCourseIds.size;
      const avg_progress     = courses_enrolled > 0 ? overall_progress_sum / courses_enrolled : 0;
      const is_active        = period_hours > 0;
      const is_compliant     = period_hours >= minMonthlyHours;

      last_activity_times.sort((a, b) => b - a);
      const latestActivity = last_activity_times[0] ?? null;
      const now = Date.now();
      const days_since_activity = latestActivity !== null
        ? Math.floor((now - latestActivity) / 86400000)
        : null;

      return {
        sub_contest_id: subContestId,
        email,
        name,
        period_hours,
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

    // Upsert learner stats
    try {
      await upsertInBatches(supabase, 'contest_coursera_learner_stats', learnerStatsRecords, 'sub_contest_id,email');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Build metrics blob
    const total_learners = learnerStatsRecords.length;
    const active_learners = learnerStatsRecords.filter(r => r.is_active).length;
    const compliant_learners = learnerStatsRecords.filter(r => r.is_compliant).length;
    const period_hours_total = learnerStatsRecords.reduce((s, r) => s + r.period_hours, 0);
    const total_completions = learnerStatsRecords.reduce((s, r) => s + r.new_completions, 0);
    const total_lifetime_hours = learnerStatsRecords.reduce((s, r) => s + r.cumulative_hours, 0);
    const avg_hours_per_active = active_learners > 0 ? period_hours_total / active_learners : 0;

    metricsBlob = {
      total_learners,
      active_learners,
      inactive_learners: total_learners - active_learners,
      compliant_learners,
      period_hours: period_hours_total,
      total_lifetime_hours,
      avg_hours_per_active_learner: avg_hours_per_active,
      period_completions: total_completions,
      overall_completion_rate: learnerStatsRecords.reduce((s, r) => s + r.courses_enrolled, 0) > 0
        ? (learnerStatsRecords.reduce((s, r) => s + r.courses_completed, 0) /
           learnerStatsRecords.reduce((s, r) => s + r.courses_enrolled, 0)) * 100
        : 0,
      config: { minimum_monthly_hours: minMonthlyHours },
      top_learners_by_period_hours: [...learnerStatsRecords]
        .sort((a, b) => b.period_hours - a.period_hours)
        .slice(0, 20)
        .map(r => ({ email: r.email, name: r.name, period_hours: r.period_hours, cumulative_hours: r.cumulative_hours })),
      generated_at: new Date().toISOString(),
    };

    // Upsert computed metrics
    const { error: metricsErr } = await supabase
      .from('contest_coursera_computed_metrics')
      .upsert({
        sub_contest_id: subContestId,
        metrics: metricsBlob,
        generated_by: uploadedBy,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'sub_contest_id' });

    if (metricsErr) {
      return NextResponse.json({ error: `Failed to save metrics: ${metricsErr.message}` }, { status: 500 });
    }
  } else {
    // contest_start: store baseline learner stats (period_hours = 0 until end import)
    // The snapshots (with import_type='contest_start') are the authoritative baseline.
    // learner_stats here is informational only — the end import re-derives from snapshots.
    const startLearnerStats = Array.from(byEmail.entries()).map(([email, rows]) => ({
      sub_contest_id: subContestId,
      email,
      name: rows[0].name,
      period_hours: 0, // no delta yet — will be computed properly at contest_end import
      cumulative_hours: rows.reduce((s, r) => s + r.cumulative_learning_hours, 0),
      courses_enrolled: rows.length,
      courses_active: 0,
      courses_completed: rows.filter(r => r.completed).length,
      new_completions: 0,
      avg_progress: rows.reduce((s, r) => s + r.overall_progress, 0) / rows.length,
      is_active: false,
      is_compliant: false,
      days_since_activity: null,
    }));

    try {
      await upsertInBatches(supabase, 'contest_coursera_learner_stats', startLearnerStats, 'sub_contest_id,email');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── STEP 6: Write import log ─────────────────────────────────────────────
  await supabase.from('contest_coursera_import_log').insert({
    sub_contest_id:    subContestId,
    filename:          file.name,
    file_size_bytes:   file.size,
    rows_imported:     finalRows.length,
    learners_affected: learnersAffected,
    action:            'import',
    import_type:       importType,
    status:            'success',
    duration_ms:       Date.now() - startTime,
    imported_by:       uploadedBy,
  });

  revalidatePath('/contests/coursera');
  revalidatePath('/contests');

  return NextResponse.json({
    success: true,
    rowsImported: finalRows.length,
    learnersAffected,
    skippedRows,
    durationMs: Date.now() - startTime,
    subContestId,
    importType,
    metricsComputed: importType === 'contest_end',
  });
}
