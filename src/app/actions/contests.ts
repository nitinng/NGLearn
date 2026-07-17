'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// ── TYPES ────────────────────────────────────────────────────────
export interface ContestSeries {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface SubContest {
  id: string;
  series_id: string;
  name: string;
  user_list_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface UserList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface UserListMember {
  id: number;
  list_id: string;
  email: string;
  name: string | null;
  added_at: string;
}

// ── ACTIONS ──────────────────────────────────────────────────────

export async function getContestSeries(): Promise<ContestSeries[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('contest_series')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createContestSeries(name: string, description?: string, startDate?: string, endDate?: string): Promise<ContestSeries> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('contest_series')
    .insert({ 
      name, 
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/contests/coursera/user-list');
  return data;
}

export async function getSubContests(seriesId?: string) {
  const supabase = createAdminClient();
  let query = supabase.from('sub_contests')
    .select('*, contest_user_lists(name), contest_series(name)')
    .order('created_at', { ascending: false });
  if (seriesId) {
    query = query.eq('series_id', seriesId);
  }
  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data;
}

export async function createSubContest(seriesId: string, name: string, startDate: string, endDate: string, userListId?: string | null) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sub_contests')
    .insert({ 
      series_id: seriesId, 
      name, 
      start_date: startDate,
      end_date: endDate,
      user_list_id: userListId || null 
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/contests/coursera');
  revalidatePath('/contests/coursera/user-list');
  return data;
}

export async function getUserLists() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('contest_user_lists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createUserList(name: string, members: { email: string; name?: string }[]) {
  const supabase = createAdminClient();
  
  // 1. Create list
  const { data: listData, error: listError } = await supabase
    .from('contest_user_lists')
    .insert({ name })
    .select()
    .single();

  if (listError) throw new Error(listError.message);

  // 2. Add members
  if (members.length > 0) {
    const { error: membersError } = await supabase
      .from('contest_user_list_members')
      .insert(members.map(m => ({
        list_id: listData.id,
        email: m.email.toLowerCase().trim(),
        name: m.name?.trim() || null
      })));

    if (membersError) throw new Error(membersError.message);
  }

  revalidatePath('/contests/coursera/user-list');
  return listData;
}

export async function getImportLogs() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('contest_coursera_import_log')
    .select(`*, sub_contests(name)`)
    .order('imported_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data;
}
