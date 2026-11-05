'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasAccess } from '@/lib/access';

export interface CourseraSettings {
  weeklyTargetHours: number;
  inactiveAfterDays: number;
}

export async function getCourseraSettings(): Promise<CourseraSettings> {
  if (!(await hasAccess('data_management.import_coursera', 'view'))) throw new Error('Unauthorized');
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coursera_config')
    .select('minimum_monthly_hours, inactive_after_days')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    weeklyTargetHours: Number(data?.minimum_monthly_hours ?? 5),
    inactiveAfterDays: Number(data?.inactive_after_days ?? 90),
  };
}

/**
 * Saves the targets and re-flags every stored learner-week against the new
 * weekly target, so dashboards, logs and exports agree immediately.
 */
export async function saveCourseraSettings(input: CourseraSettings): Promise<{ ok: true; reflagged: number } | { ok: false; error: string }> {
  if (!(await hasAccess('data_management.import_coursera', 'edit'))) return { ok: false, error: 'You do not have permission to change Coursera settings.' };

  const target = Number(input.weeklyTargetHours);
  const inactive = Math.round(Number(input.inactiveAfterDays));
  if (!Number.isFinite(target) || target <= 0 || target > 100) return { ok: false, error: 'Weekly target must be between 0.5 and 100 hours.' };
  if (!Number.isFinite(inactive) || inactive < 7 || inactive > 365) return { ok: false, error: 'Inactivity threshold must be between 7 and 365 days.' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('coursera_config')
    .upsert({ id: 1, minimum_monthly_hours: target, inactive_after_days: inactive, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };

  // Re-flag stored weeks: on target = hours learned that week >= target.
  const on = await supabase.from('coursera_learner_month').update({ is_compliant: true }, { count: 'exact' }).gte('monthly_hours', target).eq('is_compliant', false);
  const off = await supabase.from('coursera_learner_month').update({ is_compliant: false }, { count: 'exact' }).lt('monthly_hours', target).eq('is_compliant', true);
  if (on.error || off.error) return { ok: false, error: (on.error ?? off.error)!.message };

  revalidatePath('/settings/targets');
  revalidatePath('/dashboard');
  return { ok: true, reflagged: (on.count ?? 0) + (off.count ?? 0) };
}
