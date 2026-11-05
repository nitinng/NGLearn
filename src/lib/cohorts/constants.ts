/** Programs that track Coursera learning by cohort. Add new ones here. */
export const PROGRAMS = ['Zuvy', 'MSDF'] as const;
export type Program = (typeof PROGRAMS)[number];

export function isProgram(value: unknown): value is Program {
  return typeof value === 'string' && (PROGRAMS as readonly string[]).includes(value);
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_SNAPSHOT_ROWS = 100_000;
export const MAX_COHORT_MEMBERS = 5_000;

/** How many past snapshots the weekly trend chart covers. */
export const TREND_SNAPSHOTS = 12;
