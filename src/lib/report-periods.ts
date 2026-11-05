/**
 * Weekly reporting periods.
 *
 * Rules (agreed with the Zuvy team):
 *   - The FIRST import is a one-off "baseline": Coursera's lifetime report up to a Sunday.
 *   - Every later import ends on a later Sunday whose week has finished. Normally that is
 *     the very next week; weeks may be skipped (Coursera can't export a past week), in which
 *     case that import covers several weeks ("Weeks 2–5") and hours are merged.
 *   - A snapshot is stored under its Sunday (period end) date. Nothing may be inserted
 *     before the latest import.
 *   - Week 1 = the Monday after the baseline Sunday through the next Sunday.
 * Dates are plain YYYY-MM-DD strings; weekdays are computed in UTC to avoid timezone drift.
 */

export const REPORT_TIMEZONE = 'Asia/Kolkata';
const DAY_MS = 86_400_000;

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toUtc(iso).getTime() + days * DAY_MS));
}

export function isSunday(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && toUtc(iso).getUTCDay() === 0;
}

/** Today's date in India (YYYY-MM-DD). */
export function todayInReportTz(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The most recent Sunday whose week has fully ended (i.e. strictly before today). */
export function lastCompletedSunday(now = new Date()): string {
  const today = todayInReportTz(now);
  const dow = toUtc(today).getUTCDay(); // 0 = Sunday
  return addDays(today, dow === 0 ? -7 : -dow);
}

/** Last `count` completed Sundays, newest first (for choosing the baseline). */
export function recentCompletedSundays(count = 12, now = new Date()): string[] {
  const last = lastCompletedSunday(now);
  return Array.from({ length: count }, (_, i) => addDays(last, -7 * i));
}

/** True once the week ending on `sunday` is over (we are on the following Monday or later). */
export function weekHasEnded(sunday: string, now = new Date()): boolean {
  return todayInReportTz(now) > sunday;
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  toUtc(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts }).replace(',', '');

export interface ReportPeriod {
  kind: 'baseline' | 'week' | 'other';
  /** 0 for baseline, 1.. for weeks */
  week: number | null;
  /** Monday (null for baseline: lifetime) */
  start: string | null;
  /** Sunday = the stored snapshot date */
  end: string;
  /** e.g. "Week 3 · Mon 17 Nov – Sun 23 Nov 2026" */
  label: string;
  /** e.g. "Wk 3 · 17–23 Nov" */
  shortLabel: string;
}

/**
 * Describes a stored snapshot date. `prev` is the snapshot before it (defaults to one week
 * earlier); when the gap is several weeks the period is labelled "Weeks M–N".
 */
export function describePeriod(end: string, baseline: string | null | undefined, prev?: string | null): ReportPeriod & { weeks: number } {
  const endLong = fmt(end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (!baseline || end === baseline) {
    return {
      kind: 'baseline', week: 0, weeks: 0, start: null, end,
      label: `Baseline · lifetime up to ${endLong}`,
      shortLabel: `Baseline · to ${fmt(end, { day: 'numeric', month: 'short' })}`,
    };
  }
  const diff = Math.round((toUtc(end).getTime() - toUtc(baseline).getTime()) / DAY_MS);
  if (diff > 0 && diff % 7 === 0 && isSunday(end)) {
    const week = diff / 7;
    const prevDiff = prev ? Math.round((toUtc(end).getTime() - toUtc(prev).getTime()) / DAY_MS) : 7;
    const weeks = prevDiff > 0 && prevDiff % 7 === 0 ? prevDiff / 7 : 1;
    const firstWeek = week - weeks + 1;
    const start = addDays(end, -7 * weeks + 1);
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const short = sameMonth
      ? `${fmt(start, { day: 'numeric' })}–${fmt(end, { day: 'numeric', month: 'short' })}`
      : `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`;
    const name = weeks === 1 ? `Week ${week}` : `Weeks ${firstWeek}–${week}`;
    const shortName = weeks === 1 ? `Wk ${week}` : `Wks ${firstWeek}–${week}`;
    return {
      kind: 'week', week, weeks, start, end,
      label: `${name} · ${fmt(start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${endLong}`,
      shortLabel: `${shortName} · ${short}`,
    };
  }
  // Snapshot that does not fit the weekly grid (should not happen with the guarded importer).
  return { kind: 'other', week: null, weeks: 1, start: null, end, label: `Snapshot ${endLong}`, shortLabel: fmt(end, { day: 'numeric', month: 'short' }) };
}

/** Labeller for a list of stored snapshot dates (any order): knows the baseline and each previous snapshot. */
export function makePeriodLabeler(dates: string[]) {
  const sorted = [...new Set(dates.filter(Boolean))].sort();
  const baseline = sorted[0] ?? null;
  const prevOf = new Map(sorted.map((d, i) => [d, i > 0 ? sorted[i - 1] : null]));
  return (date: string) => describePeriod(date, baseline ?? date, prevOf.has(date) ? prevOf.get(date) : null);
}

/** Number of weeks a snapshot covers (1 for a normal week, 0 for the baseline). */
export function periodWeeks(date: string, dates: string[]): number {
  return makePeriodLabeler([...dates, date])(date).weeks;
}

/**
 * Sundays that can be imported next: every finished week after the latest import
 * (oldest first). Empty list before the baseline exists.
 */
export function uploadableSundays(dates: string[], now = new Date()): string[] {
  if (!dates.length) return [];
  const latest = [...dates].sort().pop()!;
  const lastDone = lastCompletedSunday(now);
  const out: string[] = [];
  for (let d = addDays(latest, 7); d <= lastDone; d = addDays(d, 7)) out.push(d);
  return out;
}

/** Completed Sundays going back to `earliest` (newest first), for choosing the baseline. */
export function completedSundaysSince(earliest: string, now = new Date()): string[] {
  const out: string[] = [];
  for (let d = lastCompletedSunday(now); d >= earliest; d = addDays(d, -7)) out.push(d);
  return out;
}

/** The only period that may be imported next, given the stored snapshot dates. */
export function nextExpectedPeriod(snapshotDates: string[]): { kind: 'baseline' } | (ReportPeriod & { kind: 'week' }) {
  if (!snapshotDates.length) return { kind: 'baseline' };
  const sorted = [...snapshotDates].sort();
  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];
  return describePeriod(addDays(latest, 7), baseline) as ReportPeriod & { kind: 'week' };
}
