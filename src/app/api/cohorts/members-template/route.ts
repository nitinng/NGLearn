import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireCohortApi } from '@/lib/cohorts/guard';

export const runtime = 'nodejs';

export async function GET() {
  const actor = await requireCohortApi('view');
  if (actor instanceof NextResponse) return actor;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Members');
  ws.columns = [
    { header: 'Email', key: 'email', width: 34 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Alt Email', key: 'alt', width: 34 },
  ];
  ws.addRow({ email: 'learner@example.org', name: 'Example Learner', alt: 'learner.personal@example.com' });
  ws.getRow(1).font = { bold: true };
  const help = wb.addWorksheet('How to use');
  help.getColumn(1).width = 100;
  help.addRow(['Fill the Members sheet: one learner per row. Only Email is required.']);
  help.addRow(['Alt Email is optional: use it when the learner signed in to Coursera with a different email.']);
  help.addRow(['Delete the example row before uploading.']);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="cohort_members_template.xlsx"',
    },
  });
}
