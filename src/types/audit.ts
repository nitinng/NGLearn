// ============================================================
// Audit Log Types
// ============================================================

export type ActionType = 'INSERT' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE';

export type AuditableTable = 'alumni_master' | 'alumni_profile';

/**
 * Mirrors the `audit_log` table.
 * record_id is TEXT to support both email PKs (alumni_master)
 * and UUID PKs (alumni_profile and other tables).
 */
export interface AuditLog {
  id: string;
  table_name: AuditableTable | string;
  record_id: string;       // email for alumni_master; UUID string for others
  field_name: string;      // '*' for DELETE entries (full row snapshot)
  old_value: string | null;
  new_value: string | null;
  action_type: ActionType;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  changed_by_role: string | null;
  changed_at: string;      // ISO timestamp
  ip_address: string | null;
}

/**
 * A reconstructed point-in-time snapshot of a record,
 * derived by replaying audit log entries up to a given timestamp.
 */
export interface RecordSnapshot {
  record_id: string;
  table_name: string;
  as_of: string;           // ISO timestamp
  fields: Record<string, string | null>;
}
