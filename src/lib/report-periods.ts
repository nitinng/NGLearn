/**
 * Weekly reporting periods.
 *
 * Rules (agreed with the Zuvy team):
 *   - The FIRST import is a one-off "baseline": Coursera's lifetime report up to a Sunday.
 *   - Every later import covers exactly one Monday→Sunday week, generated on/after the
 *     following Monday, and must be the week straight after the previous import.
 *   - A snapshot is stored under its Sunday (period end) date.
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

/** Describes a stored snapshot date relative to the baseline (oldest snapshot). */
export function describePeriod(end: string, baseline: string | null | undefined): ReportPeriod {
  const endLong = fmt(end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (!baseline || end === baseline) {
    return {
      kind: 'baseline', week: 0, start: null, end,
      label: `Baseline · lifetime up to ${endLong}`,
      shortLabel: `Baseline · to ${fmt(end, { day: 'numeric', month: 'short' })}`,
    };
  }
  const diff = Math.round((toUtc(end).getTime() - toUtc(baseline).getTime()) / DAY_MS);
  if (diff > 0 && diff % 7 === 0 && isSunday(end)) {
    const week = diff / 7;
    const start = addDays(end, -6);
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const short = sameMonth
      ? `${fmt(start, { day: 'numeric' })}–${fmt(end, { day: 'numeric', month: 'short' })}`
      : `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`;
    return {
      kind: 'week', week, start, end,
      label: `Week ${week} · ${fmt(start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${endLong}`,
      shortLabel: `Wk ${week} · ${short}`,
    };
  }
  // Snapshot that does not fit the weekly grid (should not happen with the guarded importer).
  return { kind: 'other', week: null, start: null, end, label: `Snapshot ${endLong}`, shortLabel: fmt(end, { day: 'numeric', month: 'short' }) };
}

/** The only period that may be imported next, given the stored snapshot dates. */
export function nextExpectedPeriod(snapshotDates: string[]): { kind: 'baseline' } | (ReportPeriod & { kind: 'week' }) {
  if (!snapshotDates.length) return { kind: 'baseline' };
  const sorted = [...snapshotDates].sort();
  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];
  return describePeriod(addDays(latest, 7), baseline) as ReportPeriod & { kind: 'week' };
}
