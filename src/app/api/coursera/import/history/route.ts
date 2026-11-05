import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { denyApiUnlessAccess } from '@/lib/api-guard';

/** GET: imported snapshot dates + the latest 50 import-log rows for the Import Reports page. */
export async function GET() {
  const denied = await denyApiUnlessAccess('data_management.import_coursera', 'view');
  if (denied) return denied;

  const supabase = createAdminClient();
  const [monthsRes, logRes] = await Promise.all([
    supabase.from('coursera_computed_metrics').select('month, generated_at').order('month', { ascending: false }),
    supabase.from('coursera_import_log').select('*').order('imported_at', { ascending: false }).limit(50),
  ]);
  if (monthsRes.error || logRes.error) {
    return NextResponse.json({ error: (monthsRes.error ?? logRes.error)!.message }, { status: 500 });
  }
  return NextResponse.json({ months: monthsRes.data ?? [], log: logRes.data ?? [] });
}
