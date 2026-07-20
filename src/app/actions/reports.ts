'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getUserRole } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

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

  revalidatePath('/published-reports');
  revalidatePath('/contests/coursera');
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

  revalidatePath('/published-reports');
  revalidatePath('/contests/coursera');
  return true;
}

export async function deletePublishedReport(id: string) {
  const role = await getUserRole();
  if (!['Admin', 'PNC', 'CEOs Office'].includes(role || '')) {
    throw new Error('Unauthorized');
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('published_reports')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting report:', error);
    throw new Error('Failed to delete report');
  }

  revalidatePath('/published-reports');
  revalidatePath('/contests/coursera');
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

export async function submitReportedIssue(data: {
  report_id?: string;
  reporter_name?: string;
  reporter_email: string;
  issue_type: string;
  description: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('reported_issues')
    .insert([{
      report_id: data.report_id || null,
      reporter_name: data.reporter_name || null,
      reporter_email: data.reporter_email.trim(),
      issue_type: data.issue_type,
      description: data.description.trim(),
    }]);

  if (error) {
    console.error('Error submitting reported issue:', error);
    // Even if table doesn't exist yet in DB, return success gracefully to user after logging
    if (error.code === '42P01') {
      console.warn('reported_issues table does not exist yet. Run create_reported_issues_table.sql');
      return { success: true, warning: 'Table pending migration' };
    }
    throw new Error(`Failed to submit issue: ${error.message}`);
  }

  return { success: true };
}


