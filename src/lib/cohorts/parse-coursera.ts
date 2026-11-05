import { headerNames, loadWorkbook, sheetToObjects, type CellPrimitive } from './excel';
import { MAX_SNAPSHOT_ROWS } from './constants';

/** One (learner, course) row of a Coursera "Learner Activity" export. */
export interface CourseraRow {
  email: string;
  name: string | null;
  course_id: string;
  course_name: string | null;
  university: string | null;
  course_type: string | null;
  enrollment_time: string | null;
  last_activity_time: string | null;
  overall_progress: number;
  learning_hours: number;
  completed: boolean;
  completion_time: string | null;
  course_grade: number | null;
  removed_from_program: boolean;
}

export const REQUIRED_COLUMNS = ['Email', 'Course ID', 'Learning Hours'] as const;
const PREFERRED_SHEETS = ['Learner Activity', 'Course Activity'];

export class SnapshotParseError extends Error {}

function str(v: CellPrimitive | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s === '' ? null : s;
}

function num(v: CellPrimitive | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function yes(v: CellPrimitive | undefined): boolean {
  if (typeof v === 'boolean') return v;
  const s = str(v)?.toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y' || s === '1';
}

function date(v: CellPrimitive | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v).replace(' UTC', 'Z'));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function normaliseEmail(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  return s.includes('@') ? s : null;
}

export interface ParsedSnapshot {
  sheetName: string;
  rows: CourseraRow[];
  skippedRows: number;
  duplicateRows: number;
}

/**
 * Parses the full Coursera Learner Activity export (all learners).
 * Keeps one row per (email, course) — the one with the most hours — because
 * real exports occasionally repeat rows.
 */
export async function parseCourseraExport(buffer: ArrayBuffer): Promise<ParsedSnapshot> {
  let workbook;
  try {
    workbook = await loadWorkbook(buffer);
  } catch {
    throw new SnapshotParseError('Could not read the file. Upload the .xlsx file exactly as Coursera exported it.');
  }

  const sheet =
    workbook.worksheets.find(s => PREFERRED_SHEETS.includes(s.name)) ??
    workbook.worksheets.find(s => {
      const h = headerNames(s);
      return REQUIRED_COLUMNS.every(c => h.includes(c));
    });
  if (!sheet) {
    throw new SnapshotParseError(
      `No "Learner Activity" sheet found. Sheets in file: ${workbook.worksheets.map(s => s.name).join(', ') || 'none'}`,
    );
  }

  const headers = headerNames(sheet);
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length) {
    throw new SnapshotParseError(`Missing required columns: ${missing.join(', ')}`);
  }
  if (sheet.actualRowCount - 1 > MAX_SNAPSHOT_ROWS) {
    throw new SnapshotParseError(
      `File has ${(sheet.actualRowCount - 1).toLocaleString()} rows; the limit is ${MAX_SNAPSHOT_ROWS.toLocaleString()}.`,
    );
  }

  const raw = sheetToObjects(sheet);
  const byKey = new Map<string, CourseraRow>();
  let skippedRows = 0;
  let duplicateRows = 0;

  for (const r of raw) {
    const email = normaliseEmail(r['Email']);
    const courseId = str(r['Course ID']);
    if (!email || !courseId) {
      skippedRows++;
      continue;
    }
    const row: CourseraRow = {
      email,
      name: str(r['Name']),
      course_id: courseId,
      course_name: str(r['Course']) ?? str(r['Course Name']),
      university: str(r['University']),
      course_type: str(r['Course Type']),
      enrollment_time: date(r['Enrollment Time']),
      last_activity_time: date(r['Last Course Activity Time']),
      overall_progress: num(r['Overall Progress']) ?? 0,
      learning_hours: Math.max(0, num(r['Learning Hours']) ?? 0),
      completed: yes(r['Completed']),
      completion_time: date(r['Completion Time']),
      course_grade: num(r['Course Grade']),
      removed_from_program: yes(r['Removed From Program']),
    };
    const key = `${email}|${courseId}`;
    const existing = byKey.get(key);
    if (existing) {
      duplicateRows++;
      if (row.learning_hours <= existing.learning_hours) continue;
      row.last_activity_time ??= existing.last_activity_time;
      row.enrollment_time ??= existing.enrollment_time;
    }
    byKey.set(key, row);
  }

  return { sheetName: sheet.name, rows: [...byKey.values()], skippedRows, duplicateRows };
}
