/**
 * Cohort delta engine (pure functions, no I/O).
 *
 * Coursera's "Learning Hours" is CUMULATIVE since enrollment, so the hours a
 * learner put in between two exports is (later - earlier), per course.
 *   - A course missing from the earlier snapshot counts from 0 (new enrollment).
 *   - A course missing from the later snapshot keeps its earlier value (delta 0).
 *   - Tiny negative deltas are Coursera rounding corrections: floor at 0.
 * A member can be matched on their main email or an alternate email; rows for
 * both are merged (same course on both keeps the higher hours).
 */

export interface MemberLite {
  email: string;
  alt_email: string | null;
  name: string | null;
}

export interface SnapshotRowLite {
  email: string;
  name: string | null;
  course_id: string;
  course_name: string | null;
  learning_hours: number;
  overall_progress: number;
  completed: boolean;
  last_activity_time: string | null;
}

export type LearnerStatus = 'active' | 'no_progress' | 'on_coursera' | 'not_on_coursera';

export interface CourseDelta {
  course_id: string;
  course_name: string | null;
  start_hours: number;
  end_hours: number;
  hours_learned: number;
  progress: number;
  completed: boolean;
  newly_completed: boolean;
  last_activity_time: string | null;
}

export interface LearnerResult {
  email: string;
  alt_email: string | null;
  name: string | null;
  matched_emails: string[];
  status: LearnerStatus;
  /** null when there is no baseline snapshot to compare against */
  hours_learned: number | null;
  total_hours: number;
  courses_enrolled: number;
  courses_completed: number;
  new_completions: number;
  avg_progress: number;
  last_activity_time: string | null;
  /** Days between last Coursera activity and the end snapshot date */
  days_inactive: number | null;
  courses: CourseDelta[];
}

export interface CohortSummary {
  members: number;
  on_coursera: number;
  not_on_coursera: number;
  active: number;
  no_progress: number;
  hours_learned: number | null;
  avg_hours_per_active: number | null;
  avg_hours_per_member: number | null;
  new_completions: number;
  courses_completed: number;
  total_hours: number;
  period_days: number | null;
}

export interface CohortReport {
  start_date: string | null;
  end_date: string;
  summary: CohortSummary;
  learners: LearnerResult[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function indexRows(rows: SnapshotRowLite[] | null): Map<string, SnapshotRowLite[]> {
  const m = new Map<string, SnapshotRowLite[]>();
  for (const r of rows ?? []) {
    const list = m.get(r.email);
    if (list) list.push(r);
    else m.set(r.email, [r]);
  }
  return m;
}

function coursesFor(emails: string[], index: Map<string, SnapshotRowLite[]>): Map<string, SnapshotRowLite> {
  const out = new Map<string, SnapshotRowLite>();
  for (const e of emails) {
    for (const r of index.get(e) ?? []) {
      const prev = out.get(r.course_id);
      if (!prev || Number(r.learning_hours) > Number(prev.learning_hours)) out.set(r.course_id, r);
    }
  }
  return out;
}

function daysBetween(fromIso: string, toDate: string): number {
  const end = new Date(`${toDate}T23:59:59Z`).getTime();
  return Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 86_400_000));
}

export function memberEmails(m: MemberLite): string[] {
  return [m.email, m.alt_email].filter((e): e is string => !!e);
}

export function computeCohortReport(
  members: MemberLite[],
  startRows: SnapshotRowLite[] | null,
  endRows: SnapshotRowLite[],
  endDate: string,
  startDate: string | null,
): CohortReport {
  const hasBaseline = startRows !== null;
  const startIdx = indexRows(startRows);
  const endIdx = indexRows(endRows);

  const learners: LearnerResult[] = members.map(m => {
    const emails = memberEmails(m);
    const start = coursesFor(emails, startIdx);
    const end = coursesFor(emails, endIdx);
    const matched = emails.filter(e => endIdx.has(e) || startIdx.has(e));
    const courseIds = new Set([...start.keys(), ...end.keys()]);

    const courses: CourseDelta[] = [];
    for (const cid of courseIds) {
      const s = start.get(cid);
      const e = end.get(cid) ?? s!;
      const startHours = s ? Number(s.learning_hours) : 0;
      const endHours = Number(e.learning_hours);
      courses.push({
        course_id: cid,
        course_name: e.course_name ?? s?.course_name ?? null,
        start_hours: round2(startHours),
        end_hours: round2(endHours),
        hours_learned: round2(Math.max(0, endHours - startHours)),
        progress: Number(e.overall_progress) || 0,
        completed: e.completed,
        newly_completed: hasBaseline && e.completed && !(s?.completed ?? false),
        last_activity_time: e.last_activity_time ?? s?.last_activity_time ?? null,
      });
    }
    courses.sort((a, b) => b.hours_learned - a.hours_learned || b.end_hours - a.end_hours);

    const total = courses.reduce((t, c) => t + c.end_hours, 0);
    const learned = courses.reduce((t, c) => t + c.hours_learned, 0);
    const lastActivity = courses
      .map(c => c.last_activity_time)
      .filter((t): t is string => !!t)
      .sort()
      .pop() ?? null;
    const name = m.name ?? [...end.values(), ...start.values()].find(r => r.name)?.name ?? null;

    let status: LearnerStatus;
    if (matched.length === 0) status = 'not_on_coursera';
    else if (!hasBaseline) status = 'on_coursera';
    else status = learned > 0 ? 'active' : 'no_progress';

    return {
      email: m.email,
      alt_email: m.alt_email,
      name,
      matched_emails: matched,
      status,
      hours_learned: hasBaseline ? round2(learned) : null,
      total_hours: round2(total),
      courses_enrolled: courses.length,
      courses_completed: courses.filter(c => c.completed).length,
      new_completions: courses.filter(c => c.newly_completed).length,
      avg_progress: courses.length ? round2(courses.reduce((t, c) => t + c.progress, 0) / courses.length) : 0,
      last_activity_time: lastActivity,
      days_inactive: lastActivity ? daysBetween(lastActivity, endDate) : null,
      courses,
    };
  });

  learners.sort(
    (a, b) =>
      (b.hours_learned ?? 0) - (a.hours_learned ?? 0) ||
      b.total_hours - a.total_hours ||
      (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );

  const onCoursera = learners.filter(l => l.status !== 'not_on_coursera');
  const active = learners.filter(l => l.status === 'active');
  const hoursLearned = hasBaseline ? round2(learners.reduce((t, l) => t + (l.hours_learned ?? 0), 0)) : null;

  return {
    start_date: startDate,
    end_date: endDate,
    learners,
    summary: {
      members: learners.length,
      on_coursera: onCoursera.length,
      not_on_coursera: learners.length - onCoursera.length,
      active: active.length,
      no_progress: learners.filter(l => l.status === 'no_progress').length,
      hours_learned: hoursLearned,
      avg_hours_per_active: hoursLearned !== null && active.length ? round2(hoursLearned / active.length) : null,
      avg_hours_per_member: hoursLearned !== null && learners.length ? round2(hoursLearned / learners.length) : null,
      new_completions: learners.reduce((t, l) => t + l.new_completions, 0),
      courses_completed: learners.reduce((t, l) => t + l.courses_completed, 0),
      total_hours: round2(learners.reduce((t, l) => t + l.total_hours, 0)),
      period_days:
        startDate !== null
          ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000)
          : null,
    },
  };
}

export interface TrendPoint {
  snapshot_date: string;
  previous_date: string;
  hours_learned: number;
  active: number;
  on_coursera: number;
  new_completions: number;
}

/** Week-over-week (snapshot-over-snapshot) series. `snapshots` sorted oldest first. */
export function computeTrend(
  members: MemberLite[],
  snapshots: { id: string; snapshot_date: string }[],
  rowsBySnapshot: Map<string, SnapshotRowLite[]>,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const r = computeCohortReport(
      members,
      rowsBySnapshot.get(prev.id) ?? [],
      rowsBySnapshot.get(cur.id) ?? [],
      cur.snapshot_date,
      prev.snapshot_date,
    );
    points.push({
      snapshot_date: cur.snapshot_date,
      previous_date: prev.snapshot_date,
      hours_learned: r.summary.hours_learned ?? 0,
      active: r.summary.active,
      on_coursera: r.summary.on_coursera,
      new_completions: r.summary.new_completions,
    });
  }
  return points;
}
