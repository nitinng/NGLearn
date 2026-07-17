'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

async function verifySuperAdmin() {
  const role = await getUserRole();
  if (role !== 'Admin') {
    throw new Error('Unauthorized: Only admins can perform this action.');
  }
}

export async function getCurrentUserRole() {
  return await getUserRole();
}

export interface NgMember {
  id: number;
  email: string;
  alt_email: string | null;
  full_name: string;
  team: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembersImportLog {
  id: number;
  filename: string | null;
  rows_imported: number | null;
  rows_skipped: number | null;
  action: string;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  imported_by: string | null;
  imported_at: string;
}

// ── READ ─────────────────────────────────────────────────────────

export async function getMembers(page = 1, pageSize = 100, search = ''): Promise<{ members: NgMember[]; total: number }> {
  const supabase = createAdminClient();
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('ng_members')
    .select('*', { count: 'exact' })
    .order('full_name', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,team.ilike.%${search}%,group_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { members: data ?? [], total: count ?? 0 };
}

export async function getMembersImportLog(): Promise<MembersImportLog[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ng_members_import_log')
    .select('*')
    .order('imported_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── WRITE ─────────────────────────────────────────────────────────

export async function updateMember(id: number, data: Partial<NgMember>): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('ng_members')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/settings/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function clearMembers(): Promise<{ success: boolean; error?: string }> {
  try {
    await verifySuperAdmin();
    const supabase = createAdminClient();

    // Count existing
    const { count } = await supabase.from('ng_members').select('*', { count: 'exact', head: true });

    const { error } = await supabase.from('ng_members').delete().neq('id', 0);
    if (error) return { success: false, error: error.message };

    // Log it
    await supabase.from('ng_members_import_log').insert({
      action: 'clear',
      status: 'success',
      rows_imported: 0,
      rows_skipped: count ?? 0,
    });

    revalidatePath('/settings/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getMemberStats(): Promise<{ total: number; matched_coursera: number; teams: Record<string, number> }> {
  const supabase = createAdminClient();

  // Total members
  const { count: total } = await supabase
    .from('ng_members')
    .select('*', { count: 'exact', head: true });

  // Members matched in the latest coursera snapshot
  const { data: latestMonth } = await supabase
    .from('coursera_computed_metrics')
    .select('month')
    .order('month', { ascending: false })
    .limit(1)
    .single();

  let matched_coursera = 0;
  if (latestMonth?.month) {
    const { data: memberEmails } = await supabase
      .from('ng_members')
      .select('email, alt_email');

    if (memberEmails && memberEmails.length > 0) {
      const emails = memberEmails.flatMap((m) => [m.email.toLowerCase(), m.alt_email?.toLowerCase()].filter(Boolean) as string[]);
      const { count } = await supabase
        .from('coursera_learner_stats')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_month', latestMonth.month)
        .in('email', emails);
      matched_coursera = count ?? 0;
    }
  }

  // Team distribution
  const { data: teamData } = await supabase
    .from('ng_members')
    .select('team');

  const teams: Record<string, number> = {};
  for (const row of teamData ?? []) {
    const t = row.team || 'Unassigned';
    teams[t] = (teams[t] || 0) + 1;
  }

  return { total: total ?? 0, matched_coursera, teams };
}
