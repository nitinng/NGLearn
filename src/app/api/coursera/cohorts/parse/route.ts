import { NextRequest, NextResponse } from 'next/server';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { parseCohortWorkbook } from '@/lib/cohorts/parse-cohort-workbook';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** POST multipart { file: .xlsx } → one cohort list per sheet, for preview before saving. */
export async function POST(request: NextRequest) {
  const denied = await denyApiUnlessAccess('data_management.cohorts', 'edit');
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Upload an .xlsx file with Full Name and Email columns.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'File is larger than 10 MB.' }, { status: 400 });

  try {
    const sheets = await parseCohortWorkbook(await file.arrayBuffer());
    if (!sheets.length) return NextResponse.json({ error: 'No email addresses found in the file.' }, { status: 400 });
    return NextResponse.json({ sheets });
  } catch {
    return NextResponse.json({ error: 'Could not read the file. Save it as .xlsx and try again.' }, { status: 400 });
  }
}
