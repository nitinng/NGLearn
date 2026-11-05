import type ExcelJS from 'exceljs';
import type { createAdminClient } from '@/lib/supabase/admin';
import { addDays, describePeriod } from '@/lib/report-periods';

/**
 * BETA report: the Classic workbook plus extra sheets built from the parts
 * of the Coursera export the Classic report does not use (course types /
 * projects, specializations, program membership, video clips, class dates,
 * grades, certificates) and a week-by-week trend. Classic sheets are untouched.
 */

type Admin = ReturnType<typeof createAdminClient>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface BetaContext {
  supabase: Admin;
  /** 'all' or a snapshot date (Sunday) */
  month: string;
  /** Learners in scope (the cohort's emails) */
  emails: string[];
  /** email → official name (from the cohort list) */
  names: Map<string, string>;
  baselineDate: string | null;
  cohortName: string | null;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
const BETA_TAB = { argb: 'FF8B5CF6' };
const n = (v: unknown) => Number(v) || 0;
const asDate = (v: unknown) => (v ? new Date(String(v)) : null);
const round1 = (v: number) => Math.round(v * 10) / 10;

async function fetchByEmails(supabase: Admin, table: string, emails: string[], filter: (q: Row) => Row, columns = '*'): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await filter(supabase.from(table).select(columns).in('email', chunk)).order('id').range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

function sheet(wb: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[]) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: BETA_TAB }, views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = HEADER_FILL;
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 30;
  return ws;
}

function finish(ws: ExcelJS.Worksheet, dateKeys: string[] = [], numKeys: string[] = []) {
  for (const k of dateKeys) ws.getColumn(k).numFmt = 'dd mmm yyyy';
  for (const k of numKeys) ws.getColumn(k).numFmt = '#,##0.0';
  if (ws.rowCount > 1) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }
}

const isProject = (type: unknown) => !!type && String(type) !== 'Course';

export async function addBetaSheets(wb: ExcelJS.Workbook, ctx: BetaContext): Promise<void> {
  const { supabase, emails, names, baselineDate, cohortName } = ctx;

  // Which snapshot: the selected week, or the latest one for "all".
  let snap = ctx.month;
  if (!snap || snap === 'all') {
    const { data } = await supabase.from('coursera_computed_metrics').select('month').order('month', { ascending: false }).limit(1).maybeSingle();
    snap = data?.month ?? '';
  }
  if (!snap || emails.length === 0) return;
  const period = describePeriod(snap, baselineDate ?? snap);
  const periodEnd = new Date(`${addDays(snap, 1)}T00:00:00Z`).getTime();

  const [courses, programs, specs, clips, weeks] = await Promise.all([
    fetchByEmails(supabase, 'coursera_snapshots', emails, q => q.eq('snapshot_month', snap)),
    fetchByEmails(supabase, 'coursera_program_snapshots', emails, q => q.eq('snapshot_month', snap)),
    fetchByEmails(supabase, 'coursera_specialization_snapshots', emails, q => q.eq('snapshot_month', snap)),
    fetchByEmails(supabase, 'coursera_clip_snapshots', emails, q => q.eq('snapshot_month', snap)),
    fetchByEmails(supabase, 'coursera_learner_month', emails, q => q.lte('month', snap),
      'id, month, email, monthly_hours, cumulative_hours, new_completions, is_active'),
  ]);

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const list = m.get(r.email);
      if (list) list.push(r);
      else m.set(r.email, [r]);
    }
    return m;
  };
  const coursesBy = group(courses);
  const specsBy = group(specs);
  const clipsBy = group(clips);
  const programBy = new Map(programs.map(p => [p.email, p]));
  const weekBy = new Map(weeks.filter(w => w.month === snap).map(w => [w.email, w]));
  const nameOf = (e: string) => names.get(e) ?? programBy.get(e)?.name ?? coursesBy.get(e)?.[0]?.name ?? '';

  // ── Learner 360 ──────────────────────────────────────────────────────────
  const learnerRows = emails.map(e => {
    const cs = coursesBy.get(e) ?? [];
    const realCourses = cs.filter(c => !isProject(c.course_type));
    const projects = cs.filter(c => isProject(c.course_type));
    const sp = specsBy.get(e) ?? [];
    const prog = programBy.get(e);
    const completedWithGrade = cs.filter(c => c.completed && c.course_grade !== null && c.course_grade !== undefined);
    const lastActivity = cs
      .map(c => (c.last_activity_time ? Date.parse(c.last_activity_time) : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    return {
      name: nameOf(e),
      email: e,
      on_coursera: cs.length || prog ? 'Yes' : 'No',
      member_state: prog?.member_state ?? (cs.length ? '—' : 'Not found'),
      invited: asDate(prog?.invitation_date),
      joined: asDate(prog?.join_date),
      last_program: asDate(prog?.last_program_activity),
      business_unit: prog?.business_unit ?? cs.find(c => c.business_unit)?.business_unit ?? '',
      hours_week: weekBy.has(e) ? n(weekBy.get(e)!.monthly_hours) : null,
      hours_total: round1(cs.reduce((t, c) => t + n(c.cumulative_learning_hours), 0)),
      hours_program: prog ? n(prog.learning_hours) : null,
      courses_enrolled: realCourses.length,
      courses_in_progress: realCourses.filter(c => !c.completed && n(c.overall_progress) > 0).length,
      courses_completed: realCourses.filter(c => c.completed).length,
      projects_enrolled: projects.length,
      projects_completed: projects.filter(c => c.completed).length,
      specs_enrolled: sp.length,
      specs_completed: sp.filter(s => s.completed).length,
      certificates: cs.filter(c => c.certificate_url).length + sp.filter(s => s.certificate_url).length,
      avg_grade: completedWithGrade.length
        ? round1(completedWithGrade.reduce((t, c) => t + n(c.course_grade), 0) / completedWithGrade.length)
        : null,
      avg_progress: cs.length ? round1(cs.reduce((t, c) => t + n(c.overall_progress), 0) / cs.length) : null,
      last_activity: lastActivity ? new Date(lastActivity) : null,
      days_inactive: lastActivity ? Math.max(0, Math.floor((periodEnd - lastActivity) / 86_400_000)) : null,
      clips: (clipsBy.get(e) ?? []).length,
    };
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const ws0 = wb.addWorksheet('Beta Summary', { properties: { tabColor: BETA_TAB } });
  ws0.columns = [{ width: 46 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  ws0.addRow(['BETA REPORT: extra insights from the full Coursera export']).font = { bold: true, size: 14, color: { argb: 'FF4F46E5' } };
  ws0.addRow([`${cohortName ? `Cohort: ${cohortName}   |   ` : ''}${period.label}   |   Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} IST`]).font = { italic: true, color: { argb: 'FF6B7280' } };
  ws0.addRow(['The Classic sheets in this workbook are unchanged. Beta sheets have purple tabs. Figures are for the cohort, as of the end of this week.']).font = { color: { argb: 'FF6B7280' } };
  ws0.addRow([]);

  const states = new Map<string, number>();
  for (const l of learnerRows) states.set(l.member_state, (states.get(l.member_state) ?? 0) + 1);
  const activeWeek = learnerRows.filter(l => (l.hours_week ?? 0) > 0).length;
  const projectTypes = new Map<string, { enrolled: number; completed: number }>();
  for (const c of courses.filter(c => isProject(c.course_type))) {
    const t = projectTypes.get(c.course_type) ?? { enrolled: 0, completed: 0 };
    t.enrolled++;
    if (c.completed) t.completed++;
    projectTypes.set(c.course_type, t);
  }
  const kpis: [string, number | string | null][] = [
    ['Members in cohort', emails.length],
    ['Found on Coursera', learnerRows.filter(l => l.on_coursera === 'Yes').length],
    ...[...states.entries()].sort().map(([s, c]) => [`  Program status: ${s}`, c] as [string, number]),
    ['Learned this week (hours > 0)', period.kind === 'baseline' ? 'baseline week' : activeWeek],
    ['Hours learned this week', period.kind === 'baseline' ? 'baseline week' : round1(learnerRows.reduce((t, l) => t + (l.hours_week ?? 0), 0))],
    ['Total learning hours (all time)', round1(learnerRows.reduce((t, l) => t + l.hours_total, 0))],
    ['Courses enrolled', learnerRows.reduce((t, l) => t + l.courses_enrolled, 0)],
    ['Courses in progress', learnerRows.reduce((t, l) => t + l.courses_in_progress, 0)],
    ['Courses completed', learnerRows.reduce((t, l) => t + l.courses_completed, 0)],
    ['Projects enrolled (guided / self-paced / labs)', learnerRows.reduce((t, l) => t + l.projects_enrolled, 0)],
    ['Projects completed', learnerRows.reduce((t, l) => t + l.projects_completed, 0)],
    ...[...projectTypes.entries()].map(([t, v]) => [`  ${t}: completed / enrolled`, `${v.completed} / ${v.enrolled}`] as [string, string]),
    ['Specializations enrolled', specs.length],
    ['Specializations completed', specs.filter(s => s.completed).length],
    ['Certificates earned (courses + specializations)', learnerRows.reduce((t, l) => t + l.certificates, 0)],
    ['Video clips watched', clips.length],
  ];
  for (const [k, v] of kpis) {
    const r = ws0.addRow([k, v ?? '—']);
    r.getCell(1).font = { bold: !k.startsWith('  ') };
  }

  ws0.addRow([]);
  ws0.addRow(['Top courses in this cohort']).font = { bold: true, size: 12 };
  const th = ws0.addRow(['Course', 'Type', 'Learners', 'Completed', 'Total hours', 'Avg progress %']);
  th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  th.fill = HEADER_FILL;
  const byCourse = new Map<string, { name: string; type: string; learners: number; completed: number; hours: number; progress: number }>();
  for (const c of courses) {
    const k = c.course_id;
    const t = byCourse.get(k) ?? { name: c.course_name ?? k, type: c.course_type ?? '', learners: 0, completed: 0, hours: 0, progress: 0 };
    t.learners++;
    if (c.completed) t.completed++;
    t.hours += n(c.cumulative_learning_hours);
    t.progress += n(c.overall_progress);
    byCourse.set(k, t);
  }
  for (const c of [...byCourse.values()].sort((a, b) => b.learners - a.learners || b.hours - a.hours).slice(0, 15)) {
    ws0.addRow([c.name, c.type, c.learners, c.completed, round1(c.hours), round1(c.progress / c.learners)]);
  }

  // ── Learner 360 sheet ────────────────────────────────────────────────────
  const ws1 = sheet(wb, 'Learner 360 (Beta)', [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'On Coursera', key: 'on_coursera', width: 11 },
    { header: 'Program Status', key: 'member_state', width: 18 },
    { header: 'Invited On', key: 'invited', width: 13 },
    { header: 'Joined On', key: 'joined', width: 13 },
    { header: 'Last Program Activity', key: 'last_program', width: 15 },
    { header: 'Business Unit', key: 'business_unit', width: 12 },
    { header: 'Hours This Week', key: 'hours_week', width: 11 },
    { header: 'Total Course Hours', key: 'hours_total', width: 11 },
    { header: 'Program Learning Hours', key: 'hours_program', width: 12 },
    { header: 'Courses Enrolled', key: 'courses_enrolled', width: 10 },
    { header: 'Courses In Progress', key: 'courses_in_progress', width: 10 },
    { header: 'Courses Completed', key: 'courses_completed', width: 10 },
    { header: 'Projects Enrolled', key: 'projects_enrolled', width: 10 },
    { header: 'Projects Completed', key: 'projects_completed', width: 10 },
    { header: 'Specializations Enrolled', key: 'specs_enrolled', width: 12 },
    { header: 'Specializations Completed', key: 'specs_completed', width: 12 },
    { header: 'Certificates Earned', key: 'certificates', width: 11 },
    { header: 'Avg Grade (completed)', key: 'avg_grade', width: 11 },
    { header: 'Avg Progress %', key: 'avg_progress', width: 10 },
    { header: 'Last Course Activity', key: 'last_activity', width: 14 },
    { header: 'Days Inactive (to week end)', key: 'days_inactive', width: 12 },
    { header: 'Video Clips Watched', key: 'clips', width: 10 },
  ]);
  for (const l of [...learnerRows].sort((a, b) => (b.hours_week ?? -1) - (a.hours_week ?? -1) || b.hours_total - a.hours_total)) ws1.addRow(l);
  finish(ws1, ['invited', 'joined', 'last_program', 'last_activity'], ['hours_week', 'hours_total', 'hours_program']);

  // ── Weekly trend ─────────────────────────────────────────────────────────
  const ws2 = sheet(wb, 'Weekly Trend (Beta)', [
    { header: 'Week', key: 'week', width: 42 },
    { header: 'Members With Data', key: 'members', width: 12 },
    { header: 'Active Learners', key: 'active', width: 11 },
    { header: 'Hours Learned', key: 'hours', width: 11 },
    { header: 'Avg Hours / Active Learner', key: 'avg', width: 13 },
    { header: 'Courses Completed', key: 'completions', width: 11 },
    { header: 'Total Hours (cumulative)', key: 'cumulative', width: 13 },
  ]);
  const byWeek = new Map<string, Row[]>();
  for (const w of weeks) {
    const list = byWeek.get(w.month);
    if (list) list.push(w);
    else byWeek.set(w.month, [w]);
  }
  for (const m of [...byWeek.keys()].sort()) {
    const rows = byWeek.get(m)!;
    const isBase = describePeriod(m, baselineDate ?? m).kind === 'baseline';
    const active = rows.filter(r => n(r.monthly_hours) > 0).length;
    const hours = rows.reduce((t, r) => t + n(r.monthly_hours), 0);
    ws2.addRow({
      week: describePeriod(m, baselineDate ?? m).label,
      members: rows.length,
      active: isBase ? null : active,
      hours: isBase ? null : round1(hours),
      avg: isBase || !active ? null : round1(hours / active),
      completions: isBase ? null : rows.reduce((t, r) => t + n(r.new_completions), 0),
      cumulative: round1(rows.reduce((t, r) => t + n(r.cumulative_hours), 0)),
    });
  }
  finish(ws2, [], ['hours', 'avg', 'cumulative']);

  // ── Projects ─────────────────────────────────────────────────────────────
  const ws3 = sheet(wb, 'Projects (Beta)', [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Project', key: 'course', width: 46 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Provider', key: 'university', width: 22 },
    { header: 'Enrolled', key: 'enrolled', width: 13 },
    { header: 'Last Activity', key: 'last', width: 13 },
    { header: 'Progress %', key: 'progress', width: 10 },
    { header: 'Learning Hours', key: 'hours', width: 10 },
    { header: 'Completed', key: 'completed', width: 10 },
    { header: 'Completed On', key: 'completed_on', width: 13 },
    { header: 'Grade', key: 'grade', width: 8 },
    { header: 'Certificate URL', key: 'cert', width: 40 },
  ]);
  for (const c of courses.filter(c => isProject(c.course_type)).sort((a, b) => nameOf(a.email).localeCompare(nameOf(b.email)))) {
    ws3.addRow({
      name: nameOf(c.email), email: c.email, course: c.course_name, type: c.course_type, university: c.university,
      enrolled: asDate(c.enrollment_time), last: asDate(c.last_activity_time), progress: n(c.overall_progress),
      hours: n(c.cumulative_learning_hours), completed: c.completed ? 'Yes' : 'No', completed_on: asDate(c.completion_time),
      grade: c.course_grade ?? null, cert: c.certificate_url ?? '',
    });
  }
  finish(ws3, ['enrolled', 'last', 'completed_on'], ['hours']);

  // ── Specializations ──────────────────────────────────────────────────────
  const ws4 = sheet(wb, 'Specializations (Beta)', [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Specialization', key: 'spec', width: 46 },
    { header: 'Provider', key: 'university', width: 22 },
    { header: 'Courses Done', key: 'done', width: 9 },
    { header: 'Courses Total', key: 'total', width: 9 },
    { header: 'Progress %', key: 'pct', width: 10 },
    { header: 'Completed', key: 'completed', width: 10 },
    { header: 'Enrolled', key: 'enrolled', width: 13 },
    { header: 'Last Activity', key: 'last', width: 13 },
    { header: 'Completed On', key: 'completed_on', width: 13 },
    { header: 'Est. Learning Hours', key: 'hours', width: 11 },
    { header: 'Certificate URL', key: 'cert', width: 40 },
  ]);
  for (const s of specs.sort((a, b) => nameOf(a.email).localeCompare(nameOf(b.email)))) {
    ws4.addRow({
      name: nameOf(s.email), email: s.email, spec: s.specialization, university: s.university,
      done: n(s.completed_courses), total: n(s.total_courses),
      pct: n(s.total_courses) ? Math.round((n(s.completed_courses) / n(s.total_courses)) * 100) : 0,
      completed: s.completed ? 'Yes' : 'No', enrolled: asDate(s.enrollment_time), last: asDate(s.last_activity_time),
      completed_on: asDate(s.completion_time), hours: n(s.estimated_learning_hours), cert: s.certificate_url ?? '',
    });
  }
  finish(ws4, ['enrolled', 'last', 'completed_on'], ['hours']);

  // ── Course details (all extra columns) ───────────────────────────────────
  const ws5 = sheet(wb, 'Course Details+ (Beta)', [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Course', key: 'course', width: 46 },
    { header: 'Type', key: 'type', width: 16 },
    { header: 'Provider', key: 'university', width: 22 },
    { header: 'Enrolled', key: 'enrolled', width: 13 },
    { header: 'Class Starts', key: 'class_start', width: 13 },
    { header: 'Class Ends', key: 'class_end', width: 13 },
    { header: 'Last Activity', key: 'last', width: 13 },
    { header: 'Progress %', key: 'progress', width: 10 },
    { header: 'Learning Hours', key: 'hours', width: 10 },
    { header: 'Completed', key: 'completed', width: 10 },
    { header: 'Completed On', key: 'completed_on', width: 13 },
    { header: 'Grade', key: 'grade', width: 8 },
    { header: 'Certificate URL', key: 'cert', width: 40 },
    { header: 'Collection', key: 'collection', width: 18 },
    { header: 'Contract', key: 'contract', width: 26 },
    { header: 'Contract Active', key: 'contract_active', width: 10 },
    { header: 'Removed From Program', key: 'removed', width: 10 },
  ]);
  for (const c of courses.sort((a, b) => nameOf(a.email).localeCompare(nameOf(b.email)) || n(b.cumulative_learning_hours) - n(a.cumulative_learning_hours))) {
    ws5.addRow({
      name: nameOf(c.email), email: c.email, course: c.course_name, type: c.course_type, university: c.university,
      enrolled: asDate(c.enrollment_time), class_start: asDate(c.class_start_time), class_end: asDate(c.class_end_time),
      last: asDate(c.last_activity_time), progress: n(c.overall_progress), hours: n(c.cumulative_learning_hours),
      completed: c.completed ? 'Yes' : 'No', completed_on: asDate(c.completion_time), grade: c.course_grade ?? null,
      cert: c.certificate_url ?? '', collection: c.collection_name ?? c.collection_id ?? '', contract: c.contract ?? '',
      contract_active: c.contract_active === null || c.contract_active === undefined ? '' : c.contract_active ? 'Yes' : 'No',
      removed: c.removed_from_program ? 'Yes' : 'No',
    });
  }
  finish(ws5, ['enrolled', 'class_start', 'class_end', 'last', 'completed_on'], ['hours']);

  // ── Video clips ──────────────────────────────────────────────────────────
  const ws6 = sheet(wb, 'Video Clips (Beta)', [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Course', key: 'course', width: 36 },
    { header: 'Clip', key: 'clip', width: 46 },
    { header: 'Progress %', key: 'pct', width: 10 },
    { header: 'Times Watched', key: 'times', width: 9 },
    { header: 'Watched 90%+', key: 'c90', width: 10 },
    { header: 'Led to Course Enrollment', key: 'led', width: 12 },
    { header: 'First Watched', key: 'first', width: 13 },
    { header: 'Last Watched', key: 'last', width: 13 },
    { header: 'Clip URL', key: 'url', width: 40 },
  ]);
  for (const c of clips.sort((a, b) => nameOf(a.email).localeCompare(nameOf(b.email)))) {
    ws6.addRow({
      name: nameOf(c.email), email: c.email, course: c.course_name, clip: c.clip_title ?? c.clip_name,
      pct: n(c.progress_pct), times: n(c.times_watched), c90: c.completed_90 ? 'Yes' : 'No',
      led: c.led_to_enrollment ? 'Yes' : 'No', first: asDate(c.first_activity_time), last: asDate(c.last_activity_time),
      url: c.clip_url ?? '',
    });
  }
  finish(ws6, ['first', 'last']);
}
