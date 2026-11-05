'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CohortReport, LearnerResult, LearnerStatus, TrendPoint } from '@/lib/cohorts/report';
import { StatCard } from './StatCard';
import { fmtDate, fmtHours, fmtNum } from './format';

const STATUS: Record<LearnerStatus, { label: string; cls: string }> = {
  active: { label: 'Learned', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  no_progress: { label: 'No progress', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  on_coursera: { label: 'On Coursera', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  not_on_coursera: { label: 'Not on Coursera', cls: 'bg-red-500/10 text-red-700 dark:text-red-400' },
};

type SortKey = 'hours_learned' | 'total_hours' | 'name' | 'days_inactive' | 'courses_completed';

export function CohortReportView({
  cohortId,
  snapshots,
  startId,
  endId,
  report,
  trend,
}: {
  cohortId: string;
  snapshots: { id: string; date: string }[]; // newest first
  startId: string | null;
  endId: string;
  report: CohortReport;
  trend: TrendPoint[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LearnerStatus | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('hours_learned');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const s = report.summary;
  const hasBaseline = startId !== null;
  const endDate = snapshots.find(x => x.id === endId)?.date ?? '';

  function go(nextStart: string | null, nextEnd: string) {
    const q = new URLSearchParams({ end: nextEnd, start: nextStart ?? 'none' });
    router.push(`/cohorts/${cohortId}?${q}`);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: report.learners.length };
    for (const l of report.learners) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [report.learners]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = report.learners.filter(
      l =>
        (status === 'all' || l.status === status) &&
        (!q || l.email.includes(q) || (l.alt_email ?? '').includes(q) || (l.name ?? '').toLowerCase().includes(q)),
    );
    const val = (l: LearnerResult): number | string => {
      if (sort === 'name') return (l.name ?? l.email).toLowerCase();
      if (sort === 'days_inactive') return l.days_inactive ?? Number.MAX_SAFE_INTEGER;
      return (l[sort] as number | null) ?? -1;
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'string') return va.localeCompare(vb as string);
      return sort === 'days_inactive' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [report.learners, query, status, sort]);

  const toggle = (email: string) =>
    setOpen(prev => {
      const n = new Set(prev);
      if (n.has(email)) n.delete(email);
      else n.add(email);
      return n;
    });

  const downloadHref = `/api/cohorts/${cohortId}/report?end=${endId}&start=${startId ?? 'none'}`;
  const olderThanEnd = snapshots.filter(x => x.date < endDate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">Compare from</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={startId ?? 'none'}
              onChange={e => go(e.target.value === 'none' ? null : e.target.value, endId)}
            >
              <option value="none">— totals only —</option>
              {olderThanEnd.map(x => <option key={x.id} value={x.id}>{fmtDate(x.date)}</option>)}
            </select>
          </label>
          <span className="pb-2 text-muted-foreground">→</span>
          <label className="space-y-1 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">to snapshot</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={endId}
              onChange={e => {
                const newEnd = snapshots.find(x => x.id === e.target.value)!;
                const prev = snapshots.find(x => x.date < newEnd.date);
                go(prev?.id ?? null, newEnd.id);
              }}
            >
              {snapshots.map(x => <option key={x.id} value={x.id}>{fmtDate(x.date)}</option>)}
            </select>
          </label>
          {s.period_days !== null && <span className="pb-2 text-sm text-muted-foreground">{s.period_days} days</span>}
        </div>
        <Button asChild variant="outline">
          <a href={downloadHref}><Download className="size-4" /> Download Excel</a>
        </Button>
      </div>

      {!hasBaseline && (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
          {olderThanEnd.length === 0
            ? 'This is the first snapshot, so it is the baseline. Hours learned will appear once the next week’s export is uploaded.'
            : 'Showing all-time totals. Pick a “Compare from” snapshot to see hours learned in between.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Members" value={fmtNum(s.members)} />
        <StatCard
          label="Found on Coursera"
          value={fmtNum(s.on_coursera)}
          hint={s.not_on_coursera ? `${s.not_on_coursera} not found` : 'all matched'}
          tone={s.not_on_coursera ? 'warn' : 'default'}
        />
        <StatCard
          label="Learned this period"
          value={hasBaseline ? fmtNum(s.active) : '—'}
          hint={hasBaseline && s.members ? `${Math.round((s.active / s.members) * 100)}% of members` : undefined}
          tone="good"
        />
        <StatCard
          label="Hours learned"
          value={fmtHours(s.hours_learned)}
          hint={s.avg_hours_per_active !== null ? `${fmtHours(s.avg_hours_per_active)} h per active learner` : undefined}
        />
        <StatCard label="Courses completed" value={hasBaseline ? fmtNum(s.new_completions) : fmtNum(s.courses_completed)} hint={hasBaseline ? `this period · ${s.courses_completed} all time` : 'all time'} />
        <StatCard label="Total hours (all time)" value={fmtHours(s.total_hours)} />
      </div>

      {trend.length > 1 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Week by week</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend.map(t => ({ ...t, label: fmtDate(t.snapshot_date, false) }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="h" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="a" orientation="right" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(_, p) => {
                    const t = p?.[0]?.payload as TrendPoint | undefined;
                    return t ? `${fmtDate(t.previous_date)} → ${fmtDate(t.snapshot_date)}` : '';
                  }}
                  formatter={(v, name) => [name === 'hours_learned' ? `${fmtHours(Number(v))} h` : v, name === 'hours_learned' ? 'Hours learned' : 'Active learners']}
                />
                <Bar yAxisId="h" dataKey="hours_learned" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="a" dataKey="active" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Bars: hours learned between consecutive snapshots. Line: learners with any hours that week.</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {(['all', 'active', 'no_progress', 'on_coursera', 'not_on_coursera'] as const)
              .filter(k => k === 'all' || counts[k])
              .map(k => (
                <button
                  key={k}
                  onClick={() => setStatus(k)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    status === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {k === 'all' ? 'All' : STATUS[k].label} ({counts[k] ?? 0})
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input className="w-64 pl-8" placeholder="Search name or email" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <select
              aria-label="Sort by"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
            >
              <option value="hours_learned">Hours learned</option>
              <option value="total_hours">Total hours</option>
              <option value="courses_completed">Completed</option>
              <option value="days_inactive">Most recently active</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2">Learner</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Hours learned</th>
                <th className="px-3 py-2 text-right">Total hours</th>
                <th className="px-3 py-2 text-right">Courses</th>
                <th className="px-3 py-2 text-right">Completed</th>
                <th className="px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(l => {
                const isOpen = open.has(l.email);
                return (
                  <Fragment key={l.email}>
                    <tr className={cn('hover:bg-muted/30', l.courses.length && 'cursor-pointer')} onClick={() => l.courses.length && toggle(l.email)}>
                      <td className="px-2 py-2 text-muted-foreground">
                        {l.courses.length > 0 && (isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.email}
                          {l.alt_email && <> · alt: {l.alt_email}</>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS[l.status].cls)}>{STATUS[l.status].label}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtHours(l.hours_learned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtHours(l.total_hours)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.courses_enrolled}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {l.courses_completed}
                        {l.new_completions > 0 && <span className="ml-1 text-xs text-emerald-600">+{l.new_completions}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {l.last_activity_time ? `${fmtDate(l.last_activity_time)} (${l.days_inactive}d)` : '—'}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td />
                        <td colSpan={7} className="px-3 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-left text-muted-foreground">
                              <tr>
                                <th className="py-1 pr-3">Course</th>
                                {hasBaseline && <th className="py-1 pr-3 text-right">Baseline h</th>}
                                <th className="py-1 pr-3 text-right">Latest h</th>
                                {hasBaseline && <th className="py-1 pr-3 text-right">Learned h</th>}
                                <th className="py-1 pr-3 text-right">Progress</th>
                                <th className="py-1 pr-3">Completed</th>
                                <th className="py-1">Last activity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {l.courses.map(c => (
                                <tr key={c.course_id}>
                                  <td className="py-1 pr-3">{c.course_name ?? c.course_id}</td>
                                  {hasBaseline && <td className="py-1 pr-3 text-right tabular-nums">{fmtHours(c.start_hours)}</td>}
                                  <td className="py-1 pr-3 text-right tabular-nums">{fmtHours(c.end_hours)}</td>
                                  {hasBaseline && <td className="py-1 pr-3 text-right font-medium tabular-nums">{fmtHours(c.hours_learned)}</td>}
                                  <td className="py-1 pr-3 text-right tabular-nums">{Math.round(c.progress)}%</td>
                                  <td className="py-1 pr-3">{c.completed ? (c.newly_completed ? 'Yes (new)' : 'Yes') : 'No'}</td>
                                  <td className="py-1">{fmtDate(c.last_activity_time)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No learners match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {counts.not_on_coursera > 0 && (
          <p className="text-xs text-muted-foreground">
            &ldquo;Not on Coursera&rdquo; means neither the member&rsquo;s email nor their alt email appears in the export. Add the email they use on Coursera as an Alt Email on the Members tab.
          </p>
        )}
      </section>
    </div>
  );
}
