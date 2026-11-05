import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyApiUnlessAccess } from '@/lib/api-guard';
import { IMPORT_BUCKET } from '@/lib/coursera-storage';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * POST { fileName, fileSize } → a one-time signed upload URL in the private
 * bucket. Coursera exports are often larger than the ~4.5 MB request limit
 * of serverless functions, so the browser uploads straight to Storage and
 * then calls /api/coursera/import with the returned path.
 */
export async function POST(request: NextRequest) {
  const denied = await denyApiUnlessAccess('data_management.import_coursera', 'edit');
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { fileName?: string; fileSize?: number } | null;
  const fileName = String(body?.fileName ?? '');
  const fileSize = Number(body?.fileSize ?? 0);
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 });
  }
  if (!fileSize || fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 });
  }

  const path = `imports/${Date.now()}-${randomUUID()}.xlsx`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(IMPORT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({
      error: `Could not prepare the upload: ${error?.message ?? 'unknown error'}. Has the coursera-imports bucket been created (migration 20261106000001)?`,
    }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}
