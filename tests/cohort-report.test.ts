// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCohortReport, computeTrend, type SnapshotRowLite } from '../src/lib/cohorts/report.ts';

const row = (email: string, course: string, hours: number, extra: Partial<SnapshotRowLite> = {}): SnapshotRowLite => ({
  email, name: null, course_id: course, course_name: course, learning_hours: hours,
  overall_progress: 10, completed: false, last_activity_time: '2026-10-01T00:00:00Z', ...extra,
});

const members = [
  { email: 'a@ng.org', alt_email: null, name: 'A' },
  { email: 'b@ng.org', alt_email: 'b@gmail.com', name: 'B' },
  { email: 'c@ng.org', alt_email: null, name: 'C' },     // never on Coursera
  { email: 'd@ng.org', alt_email: null, name: 'D' },     // no progress
];

test('weekly delta per course, floored at zero, alt email merged, only cohort members', () => {
  const start = [
    row('a@ng.org', 'c1', 10), row('a@ng.org', 'c2', 5),
    row('b@gmail.com', 'c1', 2),
    row('d@ng.org', 'c1', 3),
    row('outsider@ng.org', 'c1', 100),
  ];
  const end = [
    row('a@ng.org', 'c1', 12.5), row('a@ng.org', 'c2', 4.95),          // regression -> 0
    row('a@ng.org', 'c3', 1, { completed: true }),                      // new enrollment, completed
    row('b@gmail.com', 'c1', 6),
    row('d@ng.org', 'c1', 3),
    row('outsider@ng.org', 'c1', 200),
  ];
  const r = computeCohortReport(members, start, end, '2026-10-08', '2026-10-01');
  const by = Object.fromEntries(r.learners.map(l => [l.email, l]));
  assert.equal(by['a@ng.org'].hours_learned, 3.5);
  assert.equal(by['a@ng.org'].new_completions, 1);
  assert.equal(by['b@ng.org'].hours_learned, 4);
  assert.deepEqual(by['b@ng.org'].matched_emails, ['b@gmail.com']);
  assert.equal(by['c@ng.org'].status, 'not_on_coursera');
  assert.equal(by['d@ng.org'].status, 'no_progress');
  assert.equal(r.summary.members, 4);
  assert.equal(r.summary.active, 2);
  assert.equal(r.summary.hours_learned, 7.5);
  assert.equal(r.summary.period_days, 7);
});

test('course missing from later export keeps earlier hours (no negative, no double count)', () => {
  const r = computeCohortReport(members, [row('a@ng.org', 'c1', 10)], [], '2026-10-08', '2026-10-01');
  const a = r.learners.find(l => l.email === 'a@ng.org')!;
  assert.equal(a.hours_learned, 0);
  assert.equal(a.total_hours, 10);
});

test('no baseline gives totals only', () => {
  const r = computeCohortReport(members, null, [row('a@ng.org', 'c1', 10)], '2026-10-08', null);
  assert.equal(r.summary.hours_learned, null);
  assert.equal(r.learners.find(l => l.email === 'a@ng.org')!.status, 'on_coursera');
});

test('trend is snapshot over snapshot', () => {
  const snaps = [{ id: 's1', snapshot_date: '2026-10-01' }, { id: 's2', snapshot_date: '2026-10-08' }, { id: 's3', snapshot_date: '2026-10-15' }];
  const rows = new Map([
    ['s1', [row('a@ng.org', 'c1', 1)]],
    ['s2', [row('a@ng.org', 'c1', 4)]],
    ['s3', [row('a@ng.org', 'c1', 4), row('d@ng.org', 'c1', 2)]],
  ]);
  const t = computeTrend(members, snaps, rows);
  assert.deepEqual(t.map(p => [p.snapshot_date, p.hours_learned, p.active]), [['2026-10-08', 3, 1], ['2026-10-15', 2, 1]]);
});
