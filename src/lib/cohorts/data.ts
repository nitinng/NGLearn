import { createAdminClient } from '@/lib/supabase/admin';
import { TREND_SNAPSHOTS } from './constants';
import {
  computeCohortReport,
  computeTrend,
  memberEmails,
  type CohortReport,
  type MemberLite,
  type SnapshotRowLite,
  type TrendPoint,
} from './report';

type Admin = ReturnType<typeof createAdminClient>;

/** A database problem with a message that is safe and useful to show admins. */
export class CohortDbError extends Error {
  constructor(message: string, readonly setupNeeded = false) {
    super(message);
    this.name = 'CohortDbError';
  }
}

function dbError(error: { message: string; code?: string }): CohortDbError {
  // 42P01 = Postgres "undefined table"; PGRST205 = PostgREST "table not in schema cache"
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
    return new CohortDbError(
      'The cohort tracking tables are missing from the database. Run the SQL files in supabase/migrations/ (see docs/COHORT_TRACKING.md).',
      true,
    );
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT/i.test(error.message)) {
    return new CohortDbError(
      `Could not reach Supabase (${error.message}). Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and that the project still exists and is not paused.`,
      true,
    );
  }
  return new CohortDbError(`Database error: ${error.message}`);
}

/** Runs a loader; returns its value, or a displayable error message instead of crashing the page. */
export async function safeLoad<T>(fn: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    console.error('[cohorts] load failed:', e);
    if (e instanceof CohortDbError) return { data: null, error: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
      return { data: null, error: `Could not reach Supabase (${msg}). Check the project URL/keys and that the project still exists.` };
    }
    return { data: null, error: 'Something went wrong loading cohort data. Check the server logs for details.' };
  }
}

export interface SnapshotMeta {
  id: string;
  program: string;
  snapshot_date: string;
  filename: string | null;
  file_size_bytes: number | null;
  row_count: number;
  learner_count: number;
  total_hours: number;
  status: 'processing' | 'ready' | 'failed';
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface Cohort {
  id: string;
  program: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  member_count?: number;
}

export interface CohortMember extends MemberLite {
  id: number;
  added_at: string;
}

export interface ActivityLogEntry {
  id: number;
  action: string;
  program: string | null;
  cohort_id: string | null;
  snapshot_id: string | null;
  status: 'success' | 'error';
  details: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  performed_by: string | null;
  performed_at: string;
}

const ROW_COLUMNS =
  'snapshot_id, email, name, course_id, course_name, learning_hours, overall_progress, completed, last_activity_time';

export async function listSnapshots(program: string, supabase: Admin = createAdminClient()): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('cohort_snapshots')
    .select('*')
    .eq('program', program)
    .eq('status', 'ready')
    .order('snapshot_date', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []) as SnapshotMeta[];
}

export async function listCohorts(program?: string, supabase: Admin = createAdminClient()): Promise<Cohort[]> {
  let q = supabase
    .from('cohorts')
    .select('*, cohort_members(count)')
    .is('cohort_members.removed_at', null)
    .order('archived', { ascending: true })
    .order('created_at', { ascending: false });
  if (program) q = q.eq('program', program);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return (data ?? []).map(({ cohort_members, ...c }) => ({
    ...(c as Cohort),
    member_count: (cohort_members as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function getCohort(id: string, supabase: Admin = createAdminClient()): Promise<Cohort | null> {
  const { data, error } = await supabase.from('cohorts').select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  return (data as Cohort) ?? null;
}

export async function getCohortMembers(cohortId: string, supabase: Admin = createAdminClient()): Promise<CohortMember[]> {
  const out: CohortMember[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cohort_members')
      .select('id, email, alt_email, name, added_at')
      .eq('cohort_id', cohortId)
      .is('removed_at', null)
      .order('email')
      .range(from, from + 999);
    if (error) throw dbError(error);
    out.push(...((data ?? []) as CohortMember[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Rows for the given emails across the given snapshots, grouped by snapshot id. */
export async function fetchRowsForEmails(
  snapshotIds: string[],
  emails: string[],
  supabase: Admin = createAdminClient(),
): Promise<Map<string, SnapshotRowLite[]>> {
  const bySnapshot = new Map<string, SnapshotRowLite[]>(snapshotIds.map(id => [id, []]));
  if (!snapshotIds.length || !emails.length) return bySnapshot;
  const unique = [...new Set(emails)];
  const CHUNK = 150;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('cohort_snapshot_rows')
        .select(ROW_COLUMNS)
        .in('snapshot_id', snapshotIds)
        .in('email', chunk)
        .order('id')
        .range(from, from + 999);
      if (error) throw dbError(error);
      for (const r of data ?? []) {
        bySnapshot.get(r.snapshot_id)?.push({
          email: r.email,
          name: r.name,
          course_id: r.course_id,
          course_name: r.course_name,
          learning_hours: Number(r.learning_hours),
          overall_progress: Number(r.overall_progress),
          completed: r.completed,
          last_activity_time: r.last_activity_time,
        });
      }
      if (!data || data.length < 1000) break;
    }
  }
  return bySnapshot;
}

export interface CohortReportBundle {
  cohort: Cohort;
  members: CohortMember[];
  snapshots: SnapshotMeta[]; // newest first
  start: SnapshotMeta | null;
  end: SnapshotMeta | null;
  report: CohortReport | null;
  trend: TrendPoint[];
}

/**
 * Builds the cohort report between two snapshots of the cohort's program.
 * Defaults: end = latest snapshot, start = the one before it.
 * Pass startId = 'none' to show totals only (no comparison).
 */
export async function buildCohortReport(
  cohortId: string,
  opts: { startId?: string | null; endId?: string | null; withTrend?: boolean } = {},
): Promise<CohortReportBundle | null> {
  const supabase = createAdminClient();
  const cohort = await getCohort(cohortId, supabase);
  if (!cohort) return null;
  const [members, snapshots] = await Promise.all([
    getCohortMembers(cohortId, supabase),
    listSnapshots(cohort.program, supabase),
  ]);

  const end = (opts.endId && snapshots.find(s => s.id === opts.endId)) || snapshots[0] || null;
  let start: SnapshotMeta | null = null;
  if (end && opts.startId !== 'none') {
    const requested = opts.startId ? snapshots.find(s => s.id === opts.startId) : undefined;
    start =
      requested && requested.snapshot_date < end.snapshot_date
        ? requested
        : snapshots.find(s => s.snapshot_date < end.snapshot_date) ?? null;
  }

  if (!end) return { cohort, members, snapshots, start: null, end: null, report: null, trend: [] };

  const emails = members.flatMap(memberEmails);
  const trendSnaps = opts.withTrend
    ? snapshots.filter(s => s.snapshot_date <= end.snapshot_date).slice(0, TREND_SNAPSHOTS + 1).reverse()
    : [];
  const ids = [...new Set([end.id, ...(start ? [start.id] : []), ...trendSnaps.map(s => s.id)])];
  const rows = await fetchRowsForEmails(ids, emails, supabase);

  const report = computeCohortReport(
    members,
    start ? rows.get(start.id) ?? [] : null,
    rows.get(end.id) ?? [],
    end.snapshot_date,
    start?.snapshot_date ?? null,
  );
  const trend = trendSnaps.length > 1 ? computeTrend(members, trendSnaps, rows) : [];

  return { cohort, members, snapshots, start, end, report, trend };
}

export async function logActivity(
  entry: Omit<ActivityLogEntry, 'id' | 'performed_at' | 'status' | 'details' | 'error_message' | 'duration_ms' | 'cohort_id' | 'snapshot_id' | 'program'> &
    Partial<Pick<ActivityLogEntry, 'status' | 'details' | 'error_message' | 'duration_ms' | 'cohort_id' | 'snapshot_id' | 'program'>>,
  supabase: Admin = createAdminClient(),
) {
  const { error } = await supabase.from('cohort_activity_log').insert(entry);
  if (error) console.error('cohort_activity_log insert failed:', error.message);
}

export async function listActivity(limit = 100, supabase: Admin = createAdminClient()): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('cohort_activity_log')
    .select('*')
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (error) throw dbError(error);
  return (data ?? []) as ActivityLogEntry[];
}
