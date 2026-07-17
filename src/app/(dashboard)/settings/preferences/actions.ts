'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

export async function updatePreferences(payload: { allow_global_data_view?: boolean, allow_global_activity_logs_view?: boolean }) {
  const role = await getUserRole();
  if (role !== 'Admin') return { error: 'Unauthorized' };

  if (Object.keys(payload).length === 0) return { success: true };

  try {
    const adminSupabase = createAdminClient();

    const { data: existing, error: existingErr } = await adminSupabase.from('coursera_config').select('id').limit(1).maybeSingle();
    
    if (existingErr) {
      return { error: 'Failed to read configuration: ' + existingErr.message };
    }

    if (!existing) {
      // Configuration table is empty, so we must INSERT the first row.
      // We will provide dummy values for NOT NULL columns to allow settings to be saved
      // even if the Coursera API is not yet configured.
      const { error: insErr } = await adminSupabase.from('coursera_config').insert({
        client_id: 'PENDING',
        client_secret: 'PENDING',
        org_id: 'PENDING',
        ...payload
      });
      if (insErr) {
        if (insErr.message?.includes('does not exist')) {
           return { error: 'Schema out of date. Please run the ALTER TABLE script in your database to support this feature.' };
        }
        return { error: insErr.message };
      }
    } else {
       const { error: updErr } = await adminSupabase
         .from('coursera_config')
         .update(payload)
         .eq('id', existing.id);
       
       if (updErr) {
         if (updErr.message?.includes('does not exist')) {
            return { error: 'Schema out of date. Please run the ALTER TABLE script in your database to support this feature.' };
         }
         return { error: updErr.message };
       }
    }
    revalidatePath('/');
    revalidatePath('/data-management/coursera');
    revalidatePath('/settings/activity-logs');
    revalidatePath('/settings/preferences');
    return { success: true };
  } catch (e: any) {
    if (e.message?.includes('does not exist')) {
       return { error: 'Schema out of date. Please run the ALTER TABLE script in your database to support this feature.' };
    }
    return { error: e.message || 'Failed to update preferences' };
  }
}
