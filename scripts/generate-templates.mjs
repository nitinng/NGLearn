// Regenerates the downloadable import templates in public/templates/.
// Run: node scripts/generate-templates.mjs
// Example rows use @example.org addresses, which every importer ignores,
// so a template uploaded unchanged imports nothing.
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../public/templates/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
const EXAMPLE_FONT = { italic: true, color: { argb: 'FF8A8A8A' } };

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = HEADER_FILL;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function addInstructions(wb, lines) {
  const ws = wb.addWorksheet('Instructions');
  ws.getColumn(1).width = 110;
  ws.addRow(['How to use this template']).font = { bold: true, size: 13 };
  ws.addRow([]);
  for (const line of lines) ws.addRow([line]).alignment = { wrapText: true, vertical: 'top' };
}

// ── 1. Weekly Coursera report ───────────────────────────────────────────────
{
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NGLearn';
  const ws = wb.addWorksheet('Learner Activity');
  ws.columns = [
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Course', key: 'course', width: 40 },
    { header: 'Course ID', key: 'courseId', width: 26 },
    { header: 'Course Slug', key: 'slug', width: 32 },
    { header: 'University', key: 'university', width: 20 },
    { header: 'Enrollment Time', key: 'enrolled', width: 22 },
    { header: 'Last Course Activity Time', key: 'lastActivity', width: 26 },
    { header: 'Overall Progress', key: 'progress', width: 16 },
    { header: 'Completed', key: 'completed', width: 12 },
    { header: 'Removed From Program', key: 'removed', width: 22 },
    { header: 'Program Name', key: 'program', width: 18 },
    { header: 'Completion Time', key: 'completedAt', width: 22 },
    { header: 'Course Grade', key: 'grade', width: 13 },
    { header: 'Course Certificate URL', key: 'cert', width: 36 },
    { header: 'Learning Hours', key: 'hours', width: 15 },
    { header: 'Course Type', key: 'type', width: 16 },
  ];
  styleHeader(ws);
  const examples = [
    {
      name: 'Example Learner', email: 'learner.one@example.org', course: 'Python for Everybody',
      courseId: 'EXAMPLE_COURSE_ID_1', slug: 'python', university: 'University of Michigan',
      enrolled: '2026-10-01 09:00:00', lastActivity: '2026-11-03 18:20:00', progress: 42.5,
      completed: 'No', removed: 'No', program: 'NavGurukul', completedAt: '', grade: '', cert: '',
      hours: 6.25, type: 'Course',
    },
    {
      name: 'Example Learner', email: 'learner.one@example.org', course: 'Introduction to SQL',
      courseId: 'EXAMPLE_COURSE_ID_2', slug: 'intro-sql', university: 'UC Davis',
      enrolled: '2026-09-15 10:00:00', lastActivity: '2026-10-28 12:00:00', progress: 100,
      completed: 'Yes', removed: 'No', program: 'NavGurukul', completedAt: '2026-10-28 12:00:00', grade: 0.92,
      cert: '', hours: 11.5, type: 'Course',
    },
  ];
  for (const e of examples) ws.addRow(e).font = EXAMPLE_FONT;
  addInstructions(wb, [
    'Normally you do NOT need this file: upload the Coursera "Learner Activity" export exactly as Coursera generates it. This template shows the layout the importer expects.',
    'Sheet name must be "Learner Activity" (or "Course Activity").',
    'Required columns: Email, Name, Course ID, Course, Learning Hours, Overall Progress, Completed. The others are optional but recommended.',
    'Learning Hours is CUMULATIVE since enrollment (Coursera\'s own number), not hours for this week. NGLearn works out the weekly hours by comparing with the previous upload.',
    'Completed and Removed From Program are "Yes" or "No". Overall Progress is 0–100. Dates look like 2026-11-03 18:20:00.',
    'One row per learner per course. Upload the WHOLE export, not just one cohort: every learner is stored, and dashboards show only people in a cohort.',
    'The grey example rows use @example.org emails and are ignored on import, but delete them anyway if you fill this template by hand.',
    'SCHEDULE: the first import is a one-off baseline (lifetime learning up to a Sunday). After that, every Monday generate the report covering up to the PREVIOUS SUNDAY. Never include Monday: it belongs to the next week and would put hours in the wrong week.',
    'Weeks run Monday to Sunday (Week 1 = the Monday after the baseline Sunday). On Import Reports, pick the Sunday your export runs up to; skipped weeks are merged into that upload.',
  ]);
  await wb.xlsx.writeFile(new URL('coursera_weekly_report_template.xlsx', OUT).pathname);
}

// ── 2. Cohort list ──────────────────────────────────────────────────────────
{
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NGLearn';
  const ws = wb.addWorksheet('Cohort 4');
  ws.columns = [
    { header: 'Full Name', key: 'name', width: 30 },
    { header: 'NG email ID', key: 'email', width: 36 },
  ];
  styleHeader(ws);
  ws.addRow({ name: 'Example Student One', email: 'student.one@example.org' }).font = EXAMPLE_FONT;
  ws.addRow({ name: 'Example Student Two', email: 'student.two@example.org' }).font = EXAMPLE_FONT;
  addInstructions(wb, [
    'One sheet = one cohort. The sheet name becomes the cohort name (you can rename it before saving). Add more sheets to import several cohorts at once.',
    'Columns: "Full Name" and an email column (e.g. "NG email ID"). Use the email the student uses on Coursera.',
    'Replace the grey example rows with your students. Example rows (@example.org) are ignored.',
    'Upload on Export Activity Report → Import Cohort. Importing a cohort that already exists replaces its member list.',
    'This Instructions sheet is ignored on import.',
  ]);
  await wb.xlsx.writeFile(new URL('cohort_import_template.xlsx', OUT).pathname);
}

console.log('Templates written to public/templates/');
