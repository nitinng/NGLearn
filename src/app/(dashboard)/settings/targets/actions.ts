'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasAccess } from '@/lib/access';
import { makePeriodLabeler } from '@/lib/report-periods';

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

  // Re-flag stored weeks: on target = hours learned in the period >= target × weeks covered.
  const { data: snaps, error: snapErr } = await supabase
    .from('coursera_computed_metrics')
    .select('month')
    .order('month', { ascending: true });
  if (snapErr) return { ok: false, error: snapErr.message };
  const label = makePeriodLabeler((snaps ?? []).map(r => r.month as string));
  let reflagged = 0;
  for (const { month } of snaps ?? []) {
    const needed = target * Math.max(1, label(month).weeks);
    const on = await supabase.from('coursera_learner_month').update({ is_compliant: true }, { count: 'exact' })
      .eq('month', month).gte('monthly_hours', needed).eq('is_compliant', false);
    const off = await supabase.from('coursera_learner_month').update({ is_compliant: false }, { count: 'exact' })
      .eq('month', month).lt('monthly_hours', needed).eq('is_compliant', true);
    if (on.error || off.error) return { ok: false, error: (on.error ?? off.error)!.message };
    reflagged += (on.count ?? 0) + (off.count ?? 0);
  }

  revalidatePath('/settings/targets');
  revalidatePath('/dashboard');
  return { ok: true, reflagged };
}
