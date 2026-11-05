import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { computeMetricsBlob } from '@/lib/coursera-metrics';
import { addDays, isSunday, makePeriodLabeler, weekHasEnded } from '@/lib/report-periods';
import { courseExtras, parseProgramActivity, parseSpecializations, parseVideoClips } from '@/lib/coursera-extra-sheets';
import { IMPORT_BUCKET } from '@/lib/coursera-storage';

export const maxDuration = 300;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB limit
const MAX_ROWS = 100000; // Up to 100,000 rows

// Snapshot dates are kept as plain YYYY-MM-DD strings (no new Date()) to avoid IST timezone shifts.
// NGLearn tracks WEEKLY snapshots: `snapshot_month` / `month` columns hold the
// exact export date (YYYY-MM-DD), not the first day of a month.
const periodKey = (s: string) => s;
const ACTIVE_WINDOW_DAYS = 7;

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
  batchSize = 1000
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

  // ── STEP 0: Validate inputs ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
  }

  // The file arrives either directly (small files) or, for large Coursera
  // exports, as a path in the private Storage bucket that the browser uploaded to.
  const file = formData.get('file') as File | null;
  const storagePath = (formData.get('storagePath') as string | null)?.trim() || null;
  if (storagePath && !/^imports\/[A-Za-z0-9._-]+\.xlsx$/.test(storagePath)) {
    return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 });
  }
  const fileName = file?.name ?? (formData.get('fileName') as string | null)?.trim() ?? storagePath?.split('/').pop() ?? '';
  let fileSize = file?.size ?? Number(formData.get('fileSize') ?? 0);
  const snapshotMonth = (formData.get('snapshotMonth') as string | null)?.trim();
  const uploadedBy = (formData.get('uploadedBy') as string | null)?.trim() || null;
  const acknowledgeWarnings = formData.get('acknowledgeWarnings') === 'true';

  if (!file && !storagePath) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!snapshotMonth || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotMonth)) {
    return NextResponse.json({ error: 'snapshotMonth must be in YYYY-MM-DD format' }, { status: 400 });
  }
  const parsedDate = new Date(snapshotMonth);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'snapshotMonth is not a valid date' }, { status: 400 });
  }
  // ── Weekly period rules: one lifetime baseline ending on a Sunday, then
  // consecutive Monday→Sunday weeks with no gaps and no overlaps.
  const { data: existingSnaps, error: snapListErr } = await supabase
    .from('coursera_computed_metrics')
    .select('month')
    .order('month', { ascending: true });
  if (snapListErr) {
    return NextResponse.json({ error: `Could not check existing reports: ${snapListErr.message}` }, { status: 500 });
  }
  const existingDates = (existingSnaps ?? []).map(r => r.month as string);
  if (!isSunday(snapshotMonth)) {
    return NextResponse.json({ error: 'Reports must end on a Sunday.' }, { status: 400 });
  }
  if (!weekHasEnded(snapshotMonth)) {
    return NextResponse.json({
      error: `The week ending ${snapshotMonth} is not over yet. Generate and import it from Monday ${addDays(snapshotMonth, 1)}.`
    }, { status: 400 });
  }
  if (existingDates.length > 0) {
    const latest = existingDates[existingDates.length - 1];
    if (!isSunday(existingDates[0])) {
      return NextResponse.json({
        error: 'Existing reports do not follow the Monday–Sunday schedule. Roll them back and start again with a baseline report.'
      }, { status: 409 });
    }
    // Weeks may be skipped (they merge into this import) but never go backwards or overlap.
    if (snapshotMonth <= latest) {
      return NextResponse.json({
        error: `Reports must be newer than the latest import (${latest}). To replace that week, roll it back first.`
      }, { status: 409 });
    }
  }
  const period = makePeriodLabeler([...existingDates, snapshotMonth])(snapshotMonth);
  // A merged multi-week period needs the weekly target once per week to count as on target.
  const periodWeekCount = Math.max(1, period.weeks);
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 });
  }

  // Check for duplicate import (must consider rollbacks)
  const { data: latestLogs } = await supabase
    .from('coursera_import_log')
    .select('action, status')
    .eq('snapshot_month', snapshotMonth)
    .eq('status', 'success')
    .order('imported_at', { ascending: false })
    .limit(1);

  if (latestLogs && latestLogs.length > 0 && latestLogs[0].action !== 'rollback') {
    return NextResponse.json({
      error: 'A successful import already exists for this snapshot date. Roll it back first if you want to re-import.'
    }, { status: 409 });
  }

  // ── STEP 1: Parse the XLSX file ──────────────────────────────────────────
  let buffer: Buffer;
  if (file) {
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    const { data: blob, error: dlErr } = await supabase.storage.from(IMPORT_BUCKET).download(storagePath!);
    // The bytes are in memory now; remove the upload either way.
    await supabase.storage.from(IMPORT_BUCKET).remove([storagePath!]);
    if (dlErr || !blob) {
      return NextResponse.json({ error: `Could not read the uploaded file: ${dlErr?.message ?? 'not found'}` }, { status: 400 });
    }
    buffer = Buffer.from(await blob.arrayBuffer());
    fileSize = buffer.length;
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 });
    }
  }
  let workbook: ExcelJS.Workbook;
  let rawRows: Record<string, any>[] = [];
  try {
    workbook = new ExcelJS.Workbook();
    const stream = Readable.from(buffer);
    await workbook.xlsx.read(stream);

    const sheet = workbook.worksheets.find(s => s.name === 'Learner Activity' || s.name === 'Course Activity');
    
    if (!sheet) {
      return NextResponse.json({
        error: `No recognised sheet found. Sheets in file: ${workbook.worksheets.map(s => s.name).join(', ')}`
      }, { status: 400 });
    }

    if (sheet.actualRowCount === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    if (sheet.actualRowCount > MAX_ROWS) {
      return NextResponse.json({
        error: `File has too many rows (${sheet.actualRowCount.toLocaleString()} rows detected, max ${MAX_ROWS.toLocaleString()} allowed)`
      }, { status: 400 });
    }

    const headerRow = sheet.getRow(1);
    const headers = headerRow.values as (string | undefined)[];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const rowObj: Record<string, any> = {};
      let hasData = false;
      (row.values as any[]).forEach((val, colIndex) => {
        const headerName = headers[colIndex];
        if (headerName) {
          const cleanVal = val !== null && val !== undefined ? val : null;
          if (cleanVal !== null && String(cleanVal).trim() !== '') {
            hasData = true;
          }
          rowObj[String(headerName).trim()] = cleanVal;
        }
      });
      if (hasData) {
        rawRows.push(rowObj);
      }
    });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 });
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json({
        error: `File has too many rows (${rawRows.length.toLocaleString()} rows found, max ${MAX_ROWS.toLocaleString()} allowed)`
      }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse XLSX file: ${err.message}` }, { status: 400 });
  }

  const totalRows = rawRows.length;

  // ── STEP 2: Validate columns ─────────────────────────────────────────────
  const REQUIRED_COLS = [
    'Email', 'Name', 'Course ID', 'Course', 'University',
    'Course Type', 'Learning Hours', 'Overall Progress', 'Completed'
  ];
  if (rawRows.length > 0) {
    const firstRow = rawRows[0];
    const missing = REQUIRED_COLS.filter(c => !(c in firstRow));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missing.join(', ')}` }, { status: 400 });
    }
  }

  // Template example rows use the reserved example.org domain and are ignored.
  const validRows = rawRows.filter(r =>
    r['Email'] && r['Course ID'] &&
    !String(r['Email']).trim().toLowerCase().endsWith('@example.org')
  );
  const skippedRows = totalRows - validRows.length;

  // ── STEP 3: Transform rows ───────────────────────────────────────────────
  const transformedRows = validRows.map(row => ({
    snapshot_month:            snapshotMonth,
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
    estimated_course_hours:    null,
    completed:                 row['Completed']?.toString().trim() === 'Yes',
    removed_from_program:      row['Removed From Program']?.toString().trim() === 'Yes',
    completion_time:           parseDate(row['Completion Time']),
    course_grade:              row['Course Grade'] != null ? parseFloat(row['Course Grade']) : null,
    certificate_url:           row['Course Certificate URL']?.toString().trim() || null,
    ...courseExtras(row),
  }));

  // ── STEP 3.5: Deduplicate rows ───────────────────────────────────────────
  // Real world data sometimes contains duplicates for the same (email, course_id).
  // Postgres ON CONFLICT cannot update the same row twice in one statement.
  // We keep the row with the most cumulative_learning_hours.
  const seen = new Map<string, typeof transformedRows[0]>();
  for (const row of transformedRows) {
    const key = `${row.email}|${row.course_id}`;
    const existing = seen.get(key);
    if (!existing || row.cumulative_learning_hours > existing.cumulative_learning_hours) {
      seen.set(key, row);
    }
  }
  const finalRows = Array.from(seen.values());

  // ── STEP 3.6: Overlap check ─ nothing in the file may be dated after the period's Sunday.
  // Coursera timestamps are UTC; anything from Monday 00:00 UTC onward belongs to next week.
  const periodEndExclusive = new Date(`${addDays(snapshotMonth, 1)}T00:00:00Z`).getTime();
  const lateRows = finalRows.filter(r =>
    (r.last_activity_time && new Date(r.last_activity_time).getTime() >= periodEndExclusive) ||
    (r.completion_time && new Date(r.completion_time).getTime() >= periodEndExclusive)
  );
  const warnings: string[] = [];
  if (lateRows.length > 0) {
    const latest = lateRows
      .map(r => [r.last_activity_time, r.completion_time].filter(Boolean).map(t => new Date(t as string).getTime()))
      .flat()
      .reduce((a, b) => Math.max(a, b), 0);
    warnings.push(
      `${lateRows.length} row(s) have activity after ${period.end} (latest ${new Date(latest).toISOString().replace('T', ' ').slice(0, 16)} UTC). ` +
      `The report seems to include Monday or later, which would push those hours into the wrong week. Regenerate it in Coursera ending on Sunday ${period.end}.`
    );
  }
  const fileDate = fileName.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (fileDate && fileDate <= snapshotMonth) {
    warnings.push(
      `The file name says it was generated on ${fileDate}, before the week ending ${snapshotMonth} was over, so the last day(s) may be missing. Generate reports on Monday or later.`
    );
  }
  if (warnings.length > 0 && !acknowledgeWarnings) {
    return NextResponse.json({ error: 'This report may not match its week.', code: 'period_warnings', warnings, period: period.label }, { status: 422 });
  }

  // Find previous snapshot month early for carry-forward
  const { data: prevMonthRow } = await supabase
    .from('coursera_snapshots')
    .select('snapshot_month')
    .lt('snapshot_month', snapshotMonth)
    .order('snapshot_month', { ascending: false })
    .limit(1)
    .single();

  const prevMonth: string | null = prevMonthRow?.snapshot_month ?? null;

  // ── STEP 3.6: Carry forward missing courses for active learners ─────────
  if (prevMonth) {
    const prevSnapshots = await fetchAllSupabase(
      supabase.from('coursera_snapshots').select('*').eq('snapshot_month', prevMonth)
    );
      
    if (prevSnapshots && prevSnapshots.length > 0) {
      const currentKeys = new Set(finalRows.map(r => `${r.email}|${r.course_id}`));
      const currentEmails = new Set(finalRows.map(r => r.email));
      
      for (const p of prevSnapshots) {
        if (currentEmails.has(p.email) && !currentKeys.has(`${p.email}|${p.course_id}`)) {
          // Carry forward!
          finalRows.push({
            snapshot_month: snapshotMonth,
            email: p.email,
            name: p.name,
            course_id: p.course_id,
            course_name: p.course_name,
            course_slug: p.course_slug,
            university: p.university,
            course_type: p.course_type,
            program_name: p.program_name,
            enrollment_time: p.enrollment_time ? new Date(p.enrollment_time).toISOString() : null,
            last_activity_time: p.last_activity_time ? new Date(p.last_activity_time).toISOString() : null,
            overall_progress: p.overall_progress,
            cumulative_learning_hours: p.cumulative_learning_hours,
            estimated_course_hours: p.estimated_course_hours,
            completed: p.completed,
            removed_from_program: p.removed_from_program,
            completion_time: p.completion_time ? new Date(p.completion_time).toISOString() : null,
            course_grade: p.course_grade,
            certificate_url: p.certificate_url,
            external_id: p.external_id ?? null,
            class_start_time: p.class_start_time ? new Date(p.class_start_time).toISOString() : null,
            class_end_time: p.class_end_time ? new Date(p.class_end_time).toISOString() : null,
            collection_id: p.collection_id ?? null,
            collection_name: p.collection_name ?? null,
            contract: p.contract ?? null,
            contract_active: p.contract_active ?? null,
            business_unit: p.business_unit ?? null,
            job_title: p.job_title ?? null,
          });
        }
      }
    }
  }

  // ── STEP 4: Upsert snapshots ─────────────────────────────────────────────
  try {
    await upsertInBatches(supabase, 'coursera_snapshots', finalRows, 'snapshot_month,email,course_id');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── STEP 4b: Extra sheets (specializations, program membership, video clips) ──
  // Optional in the export; stored for every learner, shown only for cohort members.
  const extraCounts = { specializations: 0, programMembers: 0, videoClips: 0 };
  try {
    const extras: [string, Record<string, unknown>[], string, keyof typeof extraCounts][] = [
      ['coursera_specialization_snapshots', parseSpecializations(workbook, snapshotMonth), 'snapshot_month,email,specialization_slug', 'specializations'],
      ['coursera_program_snapshots', parseProgramActivity(workbook, snapshotMonth), 'snapshot_month,email', 'programMembers'],
      ['coursera_clip_snapshots', parseVideoClips(workbook, snapshotMonth), 'snapshot_month,email,clip_name', 'videoClips'],
    ];
    for (const [table, rows, conflict, key] of extras) {
      if (rows.length) await upsertInBatches(supabase, table, rows, conflict);
      extraCounts[key] = rows.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      error: `Course data was saved, but the extra sheets failed: ${msg}. Has migration 20261106000001_beta_report_data.sql been run? Roll back this week and import again after fixing.`
    }, { status: 500 });
  }

  // ── STEP 5: Compute monthly metrics ─────────────────────────────────────

  // 5a. Fetch config
  const { data: config } = await supabase
    .from('coursera_config')
    .select('minimum_monthly_hours, inactive_after_days, total_licenses')
    .eq('id', 1)
    .single();

  const minMonthlyHours = config?.minimum_monthly_hours ?? 5;
  const totalLicenses = config?.total_licenses ?? 0;

  // 5b. Find previous snapshot month (already done above as prevMonth)

  // 5c. Fetch previous month per-learner totals via coursera_learner_month
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

  // 5d. Group current rows by email in JS
  const byEmail = new Map<string, typeof finalRows>();
  for (const row of finalRows) {
    if (!byEmail.has(row.email)) byEmail.set(row.email, []);
    byEmail.get(row.email)!.push(row);
  }

  // 5e. Per-learner metrics

  const learnerMonthRecords = Array.from(byEmail.entries()).map(([email, rows]) => {
    const prev = prevMap.get(email) ?? { prev_hours: 0, prev_completions: 0 };

    const cumulative_hours = rows.reduce((s, r) => s + r.cumulative_learning_hours, 0);
    const monthly_hours = Math.max(0, cumulative_hours - prev.prev_hours);

    const courses_enrolled = rows.length;
    const courses_completed = rows.filter(r => r.completed).length;
    const new_completions = Math.max(0, courses_completed - prev.prev_completions);
    const avg_progress = rows.reduce((s, r) => s + r.overall_progress, 0) / rows.length;

    const is_active = monthly_hours > 0;

    // Courses touched in the week up to this snapshot
    const windowStart = new Date(snapshotMonth + 'T23:59:59Z').getTime() - ACTIVE_WINDOW_DAYS * 86400000;
    const courses_active = rows.filter(r =>
      r.last_activity_time && new Date(r.last_activity_time as any).getTime() > windowStart
    ).length;

    const activityTimes = rows
      .filter(r => r.last_activity_time)
      .map(r => new Date(r.last_activity_time!).getTime())
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

  // 5f. Upsert learner_month
  try {
    await upsertInBatches(supabase, 'coursera_learner_month', learnerMonthRecords, 'month,email');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── STEP 6: Build JSONB metrics blob ─────────────────────────────────────

  // We already fetched prevRecords in Step 5c. Just build the map for MoM deltas:
  const metricsBlob = computeMetricsBlob(
    learnerMonthRecords,
    prevRecords,
    { minMonthlyHours, inactiveAfterDays: config?.inactive_after_days ?? 90, totalLicenses },
    snapshotMonth,
  );

  // ── STEP 7: Upsert metrics blob ──────────────────────────────────────────
  const { error: metricsErr } = await supabase
    .from('coursera_computed_metrics')
    .upsert({
      month: periodKey(snapshotMonth),
      metrics: metricsBlob,
      generated_by: uploadedBy,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'month' });

  if (metricsErr) {
    return NextResponse.json({ error: `Failed to save metrics: ${metricsErr.message}` }, { status: 500 });
  }

  // ── STEP 8: Write import log ─────────────────────────────────────────────
  await supabase.from('coursera_import_log').insert({
    snapshot_month:    snapshotMonth,
    filename:          fileName,
    file_size_bytes:   fileSize,
    rows_imported:     finalRows.length,
    learners_affected: byEmail.size,
    action:            'import',
    status:            'success',
    error_message:     warnings.length ? `Imported with acknowledged warnings: ${warnings.join(' | ')}` : null,
    duration_ms:       Date.now() - startTime,
    imported_by:       uploadedBy,
  });

  // ── STEP 9: Return response ──────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    rowsImported: finalRows.length,
    learnersAffected: byEmail.size,
    period: period.label,
    extraSheets: extraCounts,
    warningsAcknowledged: warnings,
    skippedRows: totalRows - finalRows.length,
    durationMs: Date.now() - startTime,
    month: periodKey(snapshotMonth),
  });
}
