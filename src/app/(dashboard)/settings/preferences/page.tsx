import { getUserRole } from '@/lib/roles';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PreferencesClient } from './_components/PreferencesClient';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
  const role = await getUserRole();
  if (role !== 'Admin') redirect('/');

  const adminSupabase = createAdminClient();
  let allowGlobalDataView = true;
  let allowGlobalActivityLogsView = true;

  try {
    const { data: cfg } = await adminSupabase
      .from('coursera_config')
      .select('allow_global_data_view, allow_global_activity_logs_view')
      .limit(1)
      .single();
    if (cfg) {
      if (cfg.allow_global_data_view !== undefined) allowGlobalDataView = cfg.allow_global_data_view;
      if (cfg.allow_global_activity_logs_view !== undefined) allowGlobalActivityLogsView = cfg.allow_global_activity_logs_view;
    }
  } catch (e) {
    // defaults to true if column doesn't exist yet
  }

  return <PreferencesClient initialAllowGlobal={allowGlobalDataView} initialAllowGlobalLogs={allowGlobalActivityLogsView} />;
}
