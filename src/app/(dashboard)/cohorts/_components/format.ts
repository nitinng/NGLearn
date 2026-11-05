export const fmtHours = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 1 });

export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-IN');

export function fmtDate(d: string | null | undefined, withYear = true) {
  if (!d) return '—';
  const date = d.length === 10 ? new Date(`${d}T12:00:00Z`) : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

export function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000);
}
