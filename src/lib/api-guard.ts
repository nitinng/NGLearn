import { NextResponse } from 'next/server';
import { getSignedInUser, hasAccess, RESOURCE_LABELS, type ActionType } from '@/lib/access';

/**
 * Route handler guard. Returns a 401/403 response when the caller may not
 * perform `action` on `resourceId`, and `null` when they may:
 *
 *   const denied = await denyApiUnlessAccess('data_management.import_coursera', 'edit');
 *   if (denied) return denied;
 */
export async function denyApiUnlessAccess(
  resourceId: string,
  action: ActionType = 'view',
): Promise<NextResponse | null> {
  if (!(await getSignedInUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await hasAccess(resourceId, action)) return null;
  const label = RESOURCE_LABELS[resourceId] ?? resourceId;
  return NextResponse.json(
    { error: `Forbidden: your role does not have ${action} access to ${label}.` },
    { status: 403 },
  );
}

export async function hasApiAccess(resourceId: string, action: ActionType = 'view'): Promise<boolean> {
  return hasAccess(resourceId, action);
}
