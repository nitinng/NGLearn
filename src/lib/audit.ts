import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sets the audit context session variables before any DB write.
 * These are read by the fn_audit_log_changes() trigger to populate
 * changed_by_name and changed_by_role on each audit_log entry.
 *
 * MUST be called with the service-role (admin) client so that it is
 * not blocked by RLS.
 *
 * Usage:
 *   const supabaseAdmin = createAdminClient();
 *   await setAuditContext(supabaseAdmin, user.name, userRole);
 *   await supabaseAdmin.from('alumni_master').update(...);
 */
export async function setAuditContext(
  supabaseAdmin: SupabaseClient,
  userName: string,
  userRole: string
): Promise<void> {
  await Promise.all([
    supabaseAdmin.rpc('set_config', {
      parameter: 'app.current_user_name',
      value: userName || 'Unknown',
      is_local: true,
    }),
    supabaseAdmin.rpc('set_config', {
      parameter: 'app.current_user_role',
      value: userRole || 'Unknown',
      is_local: true,
    }),
  ]);
}

/**
 * Writes a manual audit log entry via the service-role client.
 * Use this for IMPORT and RESTORE actions that are orchestrated
 * in the API layer rather than triggered at the DB level.
 */
export async function writeAuditEntry(
  supabaseAdmin: SupabaseClient,
  entry: {
    table_name: string;
    record_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    action_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE';
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    changed_by_role: string | null;
    ip_address?: string | null;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_log').insert(entry);
  if (error) {
    console.error('[audit] Failed to write audit entry:', error.message);
  }
}
