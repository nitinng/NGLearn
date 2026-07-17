'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';

export async function publishContestReport(title: string, payload: any) {
  const role = await getUserRole();
  if (!['Admin', 'PNC', 'CEOs Office'].includes(role || '')) {
    throw new Error('Unauthorized');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('published_reports')
    .insert({
      title,
      report_type: 'coursera_contest',
      payload,
      created_by: role,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error publishing report:', error);
    throw new Error('Failed to publish report');
  }

  return data.id;
}

export async function getPublishedReports() {
  const role = await getUserRole();
  if (!['Admin', 'PNC', 'CEOs Office'].includes(role || '')) {
    throw new Error('Unauthorized');
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('published_reports')
    .select('id, title, report_type, created_at, created_by')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching published reports:', error);
    return [];
  }

  return data;
}

export async function getPublishedReportById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('published_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching report:', error);
    return null;
  }

  return data;
}

export async function republishContestReport(id: string, title: string, payload: any) {
  const role = await getUserRole();
  if (!['Admin', 'PNC', 'CEOs Office'].includes(role || '')) {
    throw new Error('Unauthorized');
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('published_reports')
    .update({
      title,
      payload,
      created_at: new Date().toISOString() // refresh the date
    })
    .eq('id', id);

  if (error) {
    console.error('Error republishing report:', error);
    throw new Error('Failed to republish report');
  }

  return true;
}

export async function getPublishedReportByContestId(contestId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('published_reports')
    .select('id, created_at')
    .eq('report_type', 'coursera_contest')
    .contains('payload', { selectedContestId: contestId })
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching report by contest ID:', error);
  }

  return data;
}
