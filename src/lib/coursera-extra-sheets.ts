import type ExcelJS from 'exceljs';

/**
 * Parsers for the extra sheets in Coursera's enterprise export
 * ("Specialisation Activity", "Program Activity", "Video Clip Activity").
 * All optional: older or trimmed exports without them still import.
 */

type Cell = string | number | boolean | Date | null;

function primitive(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(r => r.text).join('');
    if ('text' in v && typeof (v as { text: unknown }).text === 'string') return (v as { text: string }).text;
    if ('hyperlink' in v) return String((v as { hyperlink: string }).hyperlink);
    if ('result' in v) return primitive((v as { result: ExcelJS.CellValue }).result);
  }
  return null;
}

/** Rows of a sheet as objects keyed by trimmed header text. */
export function sheetRows(ws: ExcelJS.Worksheet | undefined): Record<string, Cell>[] {
  if (!ws || ws.actualRowCount < 2) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
    const p = primitive(c.value);
    headers[col] = p === null ? '' : String(p).trim();
  });
  const out: Record<string, Cell>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const obj: Record<string, Cell> = {};
    let has = false;
    row.eachCell({ includeEmpty: false }, (c, col) => {
      const h = headers[col];
      if (!h) return;
      const p = primitive(c.value);
      if (p !== null && String(p).trim() !== '') has = true;
      obj[h] = p;
    });
    if (has) out.push(obj);
  });
  return out;
}

export const str = (v: Cell | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s === '' ? null : s;
};
export const num = (v: Cell | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const yes = (v: Cell | undefined): boolean => String(v ?? '').trim().toLowerCase() === 'yes';
export const date = (v: Cell | undefined): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};
export const email = (v: Cell | undefined): string | null => {
  const s = str(v)?.toLowerCase() ?? null;
  return s && s.includes('@') && !s.endsWith('@example.org') ? s : null;
};

const findSheet = (wb: ExcelJS.Workbook, ...names: string[]) =>
  wb.worksheets.find(ws => names.some(n => ws.name.toLowerCase() === n.toLowerCase()));

/** Keep one row per key (the last wins). */
function dedupe<T>(rows: T[], key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
}

export function parseSpecializations(wb: ExcelJS.Workbook, snapshotMonth: string) {
  const rows = sheetRows(findSheet(wb, 'Specialisation Activity', 'Specialization Activity'));
  return dedupe(
    rows.flatMap(r => {
      const e = email(r['Email']);
      const slug = str(r['Specialization Slug']) ?? str(r['Specialisation Slug']);
      if (!e || !slug) return [];
      return [{
        snapshot_month: snapshotMonth,
        email: e,
        name: str(r['Name']),
        specialization: str(r['Specialization']) ?? str(r['Specialisation']),
        specialization_slug: slug,
        university: str(r['University']),
        enrollment_time: date(r['Enrollment Time']),
        last_activity_time: date(r['Last Specialization Activity Time']),
        completed_courses: Math.round(num(r['# Completed Courses'])),
        total_courses: Math.round(num(r['# Courses in Specialization'])),
        completed: yes(r['Completed']),
        removed_from_program: yes(r['Removed From Program']),
        completion_time: date(r['Specialization Completion Time']),
        certificate_url: str(r['Specialization Certificate URL']),
        estimated_learning_hours: num(r['Total Estimated Learning Hours (since enrolled)']),
      }];
    }),
    r => `${r.email}|${r.specialization_slug}`,
  );
}

export function parseProgramActivity(wb: ExcelJS.Workbook, snapshotMonth: string) {
  const rows = sheetRows(findSheet(wb, 'Program Activity'));
  return dedupe(
    rows.flatMap(r => {
      const e = email(r['Email']);
      if (!e) return [];
      return [{
        snapshot_month: snapshotMonth,
        email: e,
        name: str(r['Name']),
        member_state: str(r['Member State']),
        enrolled_courses: Math.round(num(r['# Enrolled Courses'])),
        completed_courses: Math.round(num(r['# Completed Courses'])),
        join_date: date(r['Join Date']),
        invitation_date: date(r['Invitation Date']),
        last_program_activity: date(r['Last Program Activity Date']),
        learning_hours: num(r['Learning Hours']),
        business_unit: str(r['Business Unit']),
        job_title: str(r['Job Title']),
      }];
    }),
    r => r.email,
  );
}

export function parseVideoClips(wb: ExcelJS.Workbook, snapshotMonth: string) {
  const rows = sheetRows(findSheet(wb, 'Video Clip Activity'));
  return dedupe(
    rows.flatMap(r => {
      const e = email(r['Email']);
      const clip = str(r['Clip Name']) ?? str(r['Clip Url']);
      if (!e || !clip) return [];
      return [{
        snapshot_month: snapshotMonth,
        email: e,
        name: str(r['Name']),
        course_id: str(r['Course ID']),
        course_name: str(r['Course']),
        clip_name: clip,
        clip_title: str(r['Clip Title']),
        clip_url: str(r['Clip Url']),
        first_activity_time: date(r['First Video Clip Activity Time']),
        last_activity_time: date(r['Last Video Clip Activity Time']),
        estimated_learning_hours: num(r['Total Estimated Learning Hours (since enrolled)']),
        progress_pct: num(r['Progress Percentage']),
        times_watched: Math.round(num(r['# of Times Watched'])),
        completed_90: yes(r['Completed at least 90% of clip']),
        led_to_enrollment: yes(r['Led to Course Enrollment']),
      }];
    }),
    r => `${r.email}|${r.clip_name}`,
  );
}

/** Extra Course Activity columns stored on coursera_snapshots. */
export function courseExtras(r: Record<string, unknown>) {
  const c = r as Record<string, Cell>;
  const active = str(c['Is Enterprise Contract Active']);
  return {
    external_id: str(c['External ID']),
    class_start_time: date(c['Class Start Time']),
    class_end_time: date(c['Class End Time']),
    collection_id: str(c['Collection ID']),
    collection_name: str(c['Collection Name']),
    contract: str(c['Contract']),
    contract_active: active === null ? null : yes(active),
    business_unit: str(c['Business Unit']),
    job_title: str(c['Job Title']),
  };
}
