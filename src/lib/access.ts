import { createClient } from '@/lib/supabase/server';
import { getUserRole, type UserRole } from '@/lib/roles';

export type ActionType = 'view' | 'edit';

/**
 * NGLearn keeps access simple: one set of roles may view Coursera data and
 * reports, a narrower set may import data and manage cohorts. The resource id
 * (kept for parity with NGConnect's RBAC calls) does not change the outcome.
 */
export const VIEW_ROLES: UserRole[] = ['Admin', 'PNC', 'CEOs Office', 'Program'];
export const EDIT_ROLES: UserRole[] = ['Admin', 'PNC', 'Program'];

export const RESOURCE_LABELS: Record<string, string> = {
  'data_management.coursera': 'Coursera Dashboard',
  'data_management.coursera_activity_logs': 'Coursera Activity Logs',
  'data_management.coursera_export': 'Export Activity Report',
  'data_management.import_coursera': 'Import Reports',
  'data_management.cohorts': 'Cohorts',
};

export async function getSignedInUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Role-based check for the signed-in user. */
export async function hasAccess(_resourceId: string, action: ActionType = 'view'): Promise<boolean> {
  const user = await getSignedInUser();
  if (!user) return false;
  const role = await getUserRole(user);
  return (action === 'edit' ? EDIT_ROLES : VIEW_ROLES).includes(role);
}
