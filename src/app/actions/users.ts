'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole, UserRole, USER_MANAGER_ROLES } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

export async function updateUserRole(userId: string, newRole: UserRole) {
  try {
    const callerRole = await getUserRole();

    if (!USER_MANAGER_ROLES.includes(callerRole)) {
      return { error: 'Unauthorized. Members cannot modify roles.' };
    }

    // PNC and CEOs Office cannot assign Admin
    if ((callerRole === 'PNC' || callerRole === 'CEOs Office') && newRole === 'Admin') {
      return { error: 'Unauthorized. You cannot assign the Admin role.' };
    }

    const adminClient = createAdminClient();

    // We must check the target user's current role.
    // PNC and CEOs Office cannot modify an existing Admin.
    if (callerRole === 'PNC' || callerRole === 'CEOs Office') {
      const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(userId);
      if (userError || !user) {
        return { error: 'Failed to fetch target user.' };
      }
      
      const targetCurrentRole = user.app_metadata?.role as UserRole | undefined;
      // We also protect the hardcoded Admin list logic somewhat, though it's hardcoded in the codebase, 
      // they shouldn't demote anyone whose current role resolves to Admin via app_metadata.
      if (targetCurrentRole === 'Admin') {
        return { error: 'Unauthorized. You cannot modify an existing Admin.' };
      }
    }

    // Perform the update
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: newRole }
    });

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function inviteNewUser(email: string, name: string, role: UserRole) {
  try {
    const callerRole = await getUserRole();

    if (!USER_MANAGER_ROLES.includes(callerRole)) {
      return { error: 'Unauthorized. Members cannot invite users.' };
    }

    // PNC and CEOs Office cannot assign Admin
    if ((callerRole === 'PNC' || callerRole === 'CEOs Office') && role === 'Admin') {
      return { error: 'Unauthorized. You cannot assign the Admin role.' };
    }

    const adminClient = createAdminClient();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { error: 'Enter a valid email address.' };
    }

    // Sign-in is Google-only, so no invite email is needed (Supabase's built-in mailer
    // allows only a few emails per hour, which caused "rate limit" errors). Create the
    // account directly; the person's first Google sign-in with this email links to it.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: { full_name: name, name },
      app_metadata: { role },
    });

    if (createError) {
      const exists = /already (been )?registered|already exists/i.test(createError.message);
      if (!exists) return { error: createError.message };
      // Already has an account (e.g. signed in before): just set the role.
      let existingId: string | null = null;
      for (let page = 1; page <= 20 && !existingId; page++) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return { error: error.message };
        existingId = data.users.find(u => u.email?.toLowerCase() === cleanEmail)?.id ?? null;
        if (data.users.length < 200) break;
      }
      if (!existingId) return { error: createError.message };
      const { error: roleError } = await adminClient.auth.admin.updateUserById(existingId, { app_metadata: { role } });
      if (roleError) return { error: roleError.message };
      revalidatePath('/settings');
      return { success: true, existing: true };
    }

    if (!created?.user) return { error: 'Could not create the user.' };

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
