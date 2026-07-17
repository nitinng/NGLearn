'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole, UserRole } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

export async function updateUserRole(userId: string, newRole: UserRole) {
  try {
    const callerRole = await getUserRole();

    // Member cannot edit roles
    if (callerRole === 'Member') {
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

    // Member cannot invite
    if (callerRole === 'Member') {
      return { error: 'Unauthorized. Members cannot invite users.' };
    }

    // PNC and CEOs Office cannot assign Admin
    if ((callerRole === 'PNC' || callerRole === 'CEOs Office') && role === 'Admin') {
      return { error: 'Unauthorized. You cannot assign the Admin role.' };
    }

    const adminClient = createAdminClient();

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: name,
        name: name,
        role: role
      }
    });

    if (inviteError) {
      return { error: inviteError.message };
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
