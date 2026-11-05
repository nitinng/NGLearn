import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserRole, COHORT_EDIT_ROLES, COHORT_VIEW_ROLES, type UserRole } from '@/lib/roles';

export type CohortAccess = 'view' | 'edit';

export interface Actor {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Returns the signed-in user if their role allows `level`, else null. */
export async function getCohortActor(level: CohortAccess): Promise<Actor | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getUserRole(user);
  const allowed = level === 'edit' ? COHORT_EDIT_ROLES : COHORT_VIEW_ROLES;
  if (!allowed.includes(role)) return null;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return {
    id: user.id,
    email: user.email ?? '',
    name: meta.full_name || meta.name || user.email || 'Unknown',
    role,
  };
}

/** For API routes: returns the actor, or a 401/403 response to send back. */
export async function requireCohortApi(level: CohortAccess): Promise<Actor | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await getCohortActor(level);
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return actor;
}

/** For server actions: throws if the caller lacks access. */
export async function assertCohortAccess(level: CohortAccess): Promise<Actor> {
  const actor = await getCohortActor(level);
  if (!actor) throw new Error('You do not have permission to do this.');
  return actor;
}
