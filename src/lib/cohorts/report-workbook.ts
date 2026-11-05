import ExcelJS from 'exceljs';
import type { CohortReportBundle } from './data';
import type { LearnerStatus } from './report';

export const STATUS_LABEL: Record<LearnerStatus, string> = {
  active: 'Learned this period',
  no_progress: 'No progress',
  on_coursera: 'On Coursera',
  not_on_coursera: 'Not found on Coursera',
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/** Excel workbook for one cohort report: Summary, Learners, Course Detail, Weekly Trend. */
export async function buildReportWorkbook(bundle: CohortReportBundle): Promise<Buffer> {
  const { cohort, report, start, end, trend } = bundle;
  if (!report || !end) throw new Error('No snapshot to report on.');
  const s = report.summary;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NGLearn';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 34 }, { width: 28 }];
  const lines: [string, string | number | null][] = [
    ['Program', cohort.program],
    ['Cohort', cohort.name],
    ['Baseline snapshot', start?.snapshot_date ?? '— (totals only)'],
    ['Latest snapshot', end.snapshot_date],
    ['Days between snapshots', s.period_days],
    ['', ''],
    ['Members in cohort', s.members],
    ['Found on Coursera', s.on_coursera],
    ['Not found on Coursera', s.not_on_coursera],
    ['Learned this period (hours > 0)', start ? s.active : null],
    ['No progress this period', start ? s.no_progress : null],
    ['Hours learned this period', s.hours_learned],
    ['Avg hours per active learner', s.avg_hours_per_active],
    ['Avg hours per member', s.avg_hours_per_member],
    ['Courses completed this period', start ? s.new_completions : null],
    ['Courses completed (all time)', s.courses_completed],
    ['Total learning hours (all time)', s.total_hours],
    ['', ''],
    ['Generated at', new Date().toISOString()],
  ];
  for (const [k, v] of lines) summary.addRow([k, v ?? '—']);
  summary.getColumn(1).font = { bold: true };

  const learners = wb.addWorksheet('Learners');
  learners.columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Alt Email', key: 'alt', width: 30 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Hours Learned (period)', key: 'learned', width: 20 },
    { header: 'Total Learning Hours', key: 'total', width: 18 },
    { header: 'Courses Enrolled', key: 'enrolled', width: 15 },
    { header: 'Courses Completed', key: 'completed', width: 16 },
    { header: 'New Completions', key: 'newc', width: 15 },
    { header: 'Avg Progress %', key: 'progress', width: 14 },
    { header: 'Last Activity', key: 'last', width: 20 },
    { header: 'Days Inactive', key: 'days', width: 13 },
  ];
  for (const l of report.learners) {
    learners.addRow({
      name: l.name ?? '',
      email: l.email,
      alt: l.alt_email ?? '',
      status: STATUS_LABEL[l.status],
      learned: l.hours_learned,
      total: l.total_hours,
      enrolled: l.courses_enrolled,
      completed: l.courses_completed,
      newc: start ? l.new_completions : null,
      progress: l.avg_progress,
      last: l.last_activity_time ? new Date(l.last_activity_time) : null,
      days: l.days_inactive,
    });
  }
  learners.getColumn('last').numFmt = 'dd mmm yyyy';
  styleHeader(learners);

  const detail = wb.addWorksheet('Course Detail');
  detail.columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Course', key: 'course', width: 44 },
    { header: 'Hours at Baseline', key: 'start', width: 16 },
    { header: 'Hours at Latest', key: 'end', width: 15 },
    { header: 'Hours Learned', key: 'learned', width: 14 },
    { header: 'Progress %', key: 'progress', width: 11 },
    { header: 'Completed', key: 'completed', width: 11 },
    { header: 'Completed This Period', key: 'newc', width: 20 },
    { header: 'Last Activity', key: 'last', width: 20 },
  ];
  for (const l of report.learners) {
    for (const c of l.courses) {
      detail.addRow({
        name: l.name ?? '',
        email: l.email,
        course: c.course_name ?? c.course_id,
        start: start ? c.start_hours : null,
        end: c.end_hours,
        learned: start ? c.hours_learned : null,
        progress: c.progress,
        completed: c.completed ? 'Yes' : 'No',
        newc: start ? (c.newly_completed ? 'Yes' : 'No') : '',
        last: c.last_activity_time ? new Date(c.last_activity_time) : null,
      });
    }
  }
  detail.getColumn('last').numFmt = 'dd mmm yyyy';
  styleHeader(detail);

  if (trend.length) {
    const t = wb.addWorksheet('Weekly Trend');
    t.columns = [
      { header: 'From', key: 'from', width: 13 },
      { header: 'To', key: 'to', width: 13 },
      { header: 'Hours Learned', key: 'hours', width: 14 },
      { header: 'Active Learners', key: 'active', width: 15 },
      { header: 'Found on Coursera', key: 'on', width: 17 },
      { header: 'Courses Completed', key: 'newc', width: 17 },
    ];
    for (const p of trend) {
      t.addRow({ from: p.previous_date, to: p.snapshot_date, hours: p.hours_learned, active: p.active, on: p.on_coursera, newc: p.new_completions });
    }
    styleHeader(t);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
