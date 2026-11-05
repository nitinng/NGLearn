import { createClient } from '@/lib/supabase/server';

/**
 * Resolves the signed-in Supabase user for the current request.
 *
 * Roles are read from `app_metadata.role`, which only the service role can
 * write. Never read roles from `user_metadata`: users can edit that themselves.
 * (This file previously returned a hard-coded "Admin" for every visitor.)
 */
export async function auth() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, sessionClaims: null };
    const role = (user.app_metadata as { role?: string } | undefined)?.role;
    return {
      userId: user.id,
      sessionClaims: { metadata: { role }, role },
    };
  } catch {
    return { userId: null, sessionClaims: null };
  }
}
