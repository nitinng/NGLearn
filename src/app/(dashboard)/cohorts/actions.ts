'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertCohortAccess } from '@/lib/cohorts/guard';
import { isProgram } from '@/lib/cohorts/constants';
import { logActivity } from '@/lib/cohorts/data';

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CohortInput {
  program: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

function clean(input: CohortInput): { error: string } | Required<CohortInput> {
  const name = input.name?.trim();
  if (!isProgram(input.program)) return { error: 'Pick a program.' };
  if (!name) return { error: 'Cohort name is required.' };
  if (name.length > 120) return { error: 'Cohort name is too long.' };
  const start = input.start_date || null;
  const end = input.end_date || null;
  if ((start && !ISO_DATE.test(start)) || (end && !ISO_DATE.test(end))) return { error: 'Dates must be YYYY-MM-DD.' };
  if (start && end && end < start) return { error: 'End date is before start date.' };
  return {
    program: input.program,
    name,
    description: input.description?.trim() || null,
    start_date: start,
    end_date: end,
  };
}

export async function createCohort(input: CohortInput): Promise<Result<{ id: string }>> {
  try {
    const actor = await assertCohortAccess('edit');
    const v = clean(input);
    if ('error' in v) return { ok: false, error: v.error };
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cohorts')
      .insert({ ...v, created_by: actor.name })
      .select('id')
      .single();
    if (error) {
      return { ok: false, error: error.code === '23505' ? `"${v.name}" already exists in ${v.program}.` : error.message };
    }
    await logActivity({ action: 'cohort_create', program: v.program, cohort_id: data.id, details: { name: v.name }, performed_by: actor.name }, supabase);
    revalidatePath('/cohorts');
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateCohort(id: string, input: CohortInput & { archived?: boolean }): Promise<Result> {
  try {
    const actor = await assertCohortAccess('edit');
    const v = clean(input);
    if ('error' in v) return { ok: false, error: v.error };
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('cohorts')
      .update({ ...v, archived: !!input.archived })
      .eq('id', id);
    if (error) {
      return { ok: false, error: error.code === '23505' ? `"${v.name}" already exists in ${v.program}.` : error.message };
    }
    await logActivity({ action: 'cohort_update', program: v.program, cohort_id: id, details: { ...v, archived: !!input.archived }, performed_by: actor.name }, supabase);
    revalidatePath('/cohorts');
    revalidatePath(`/cohorts/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCohort(id: string): Promise<Result> {
  try {
    const actor = await assertCohortAccess('edit');
    const supabase = createAdminClient();
    const { data: cohort } = await supabase.from('cohorts').select('program, name').eq('id', id).maybeSingle();
    if (!cohort) return { ok: false, error: 'Cohort not found.' };
    const { error } = await supabase.from('cohorts').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    await logActivity({ action: 'cohort_delete', program: cohort.program, details: { name: cohort.name }, performed_by: actor.name }, supabase);
    revalidatePath('/cohorts');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeCohortMember(cohortId: string, memberId: number): Promise<Result> {
  try {
    const actor = await assertCohortAccess('edit');
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cohort_members')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('cohort_id', cohortId)
      .select('email')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    await logActivity({ action: 'member_remove', cohort_id: cohortId, details: { email: data?.email }, performed_by: actor.name }, supabase);
    revalidatePath(`/cohorts/${cohortId}`);
    revalidatePath('/cohorts');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
