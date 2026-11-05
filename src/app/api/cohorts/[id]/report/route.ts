import { NextRequest, NextResponse } from 'next/server';
import { requireCohortApi } from '@/lib/cohorts/guard';
import { buildCohortReport } from '@/lib/cohorts/data';
import { buildReportWorkbook } from '@/lib/cohorts/report-workbook';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** GET ?start=<snapshotId|none>&end=<snapshotId> → .xlsx download */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCohortApi('view');
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const sp = request.nextUrl.searchParams;

  const bundle = await buildCohortReport(id, {
    startId: sp.get('start'),
    endId: sp.get('end'),
    withTrend: true,
  });
  if (!bundle) return NextResponse.json({ error: 'Cohort not found.' }, { status: 404 });
  if (!bundle.report || !bundle.end) {
    return NextResponse.json({ error: 'No snapshots uploaded for this program yet.' }, { status: 400 });
  }

  const buf = await buildReportWorkbook(bundle);
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '_');
  const filename = `${safe(bundle.cohort.program)}_${safe(bundle.cohort.name)}_${bundle.start?.snapshot_date ?? 'baseline'}_to_${bundle.end.snapshot_date}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
