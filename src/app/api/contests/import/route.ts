import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  // ── STEP 4: Clear existing snapshots for this sub_contest (re-import replaces all) ─
  // Only delete for this import_type conceptually; but since snapshots are shared, 
  // we upsert by (sub_contest_id, email, course_id) which handles re-imports
  try {
    await upsertInBatches(supabase, 'contest_coursera_snapshots', finalRows, 'sub_contest_id,email,course_id');
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

  // Group current rows by email
  const byEmail = new Map<string, typeof finalRows>();
  for (const row of finalRows) {
    if (!byEmail.has(row.email)) byEmail.set(row.email, []);
    byEmail.get(row.email)!.push(row);
  }
  learnersAffected = byEmail.size;

  // For per-learner stats, we need the start snapshot to compute delta
  // Look for the "start" import to use as baseline when processing "end"
  if (importType === 'contest_end') {
    // Fetch the start snapshot data
    const { data: startSnapshots } = await supabase
      .from('contest_coursera_snapshots')
      .select('email, course_id, cumulative_learning_hours, completed')
      .eq('sub_contest_id', subContestId);

    // The start data is what was imported first (contest_start); end data is current finalRows.
    // Since we upserted everything into the same table, we need a different approach:
    // We store start snapshots with a flag in the import log, and compute delta in-memory.
    
    // For now: build per-learner stats using delta = end_hours - start_hours
    // We get start hours from the previous import log's snapshot data
    const { data: startImportLog } = await supabase
      .from('contest_coursera_import_log')
      .select('id, imported_at')
      .eq('sub_contest_id', subContestId)
      .eq('import_type', 'contest_start')
      .eq('status', 'success')
      .order('imported_at', { ascending: false })
      .limit(1);

    // Build start cumulative hours map from stored learner stats (if they exist)
    const { data: existingLearnerStats } = await supabase
      .from('contest_coursera_learner_stats')
      .select('email, cumulative_hours, courses_completed')
      .eq('sub_contest_id', subContestId);

    const startMap = new Map<string, { prev_hours: number; prev_completions: number }>();
    if (startImportLog && startImportLog.length > 0 && existingLearnerStats) {
      // If learner stats exist, they represent the start snapshot baseline
      for (const ls of existingLearnerStats) {
        startMap.set(ls.email, {
          prev_hours: Number(ls.cumulative_hours),
          prev_completions: Number(ls.courses_completed),
        });
      }
    }

    const learnerStatsRecords = Array.from(byEmail.entries()).map(([email, rows]) => {
      const start = startMap.get(email) ?? { prev_hours: 0, prev_completions: 0 };

      const cumulative_hours = rows.reduce((s, r) => s + r.cumulative_learning_hours, 0);
      const period_hours = Math.max(0, cumulative_hours - start.prev_hours);

      const courses_enrolled = rows.length;
      const courses_completed = rows.filter(r => r.completed).length;
      const new_completions = Math.max(0, courses_completed - start.prev_completions);
      const courses_active = rows.filter(r => r.last_activity_time).length;
      const avg_progress = rows.reduce((s, r) => s + r.overall_progress, 0) / rows.length;
      const is_active = period_hours > 0;
      const is_compliant = period_hours >= minMonthlyHours;

      const activityTimes = rows
        .filter(r => r.last_activity_time)
        .map(r => new Date(r.last_activity_time!).getTime())
        .sort((a, b) => b - a);
      const latestActivity = activityTimes[0] ?? null;
      const now = Date.now();
      const days_since_activity = latestActivity !== null
        ? Math.floor((now - latestActivity) / 86400000)
        : null;

      return {
        sub_contest_id: subContestId,
        email,
        name: rows[0].name,
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
    // contest_start: just store baseline learner stats (cumulative hours as baseline)
    const startLearnerStats = Array.from(byEmail.entries()).map(([email, rows]) => ({
      sub_contest_id: subContestId,
      email,
      name: rows[0].name,
      period_hours: 0, // no delta yet
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
