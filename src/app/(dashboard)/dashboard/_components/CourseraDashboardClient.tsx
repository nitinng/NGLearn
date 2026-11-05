'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  Users, Activity, Clock, BookOpen, CheckSquare, TrendingUp, TrendingDown, Award,
  UserX, Zap, Shield, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, PageShell } from '@/components/page-shell';
import { makePeriodLabeler } from '@/lib/report-periods';

// ── Types ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Metrics = Record<string, any>;
interface TrendPoint {
  month: string;
  active_learners: number;
  monthly_hours: number;
  monthly_completions: number;
  license_utilization_pct: number | null;
}

interface Props {
  metrics: Metrics;
  trend: TrendPoint[];
  selectedMonth: string;
  availableMonths: string[];
  availableMonthLabels?: Record<string, string>;
  basePath?: string;
  queryParam?: string;
  generatedAt: string;
  /** Extra query string kept when switching snapshot tabs (e.g. "cohort=<id>"). */
  extraQuery?: string;
  /** Rendered under the header, e.g. the cohort picker. */
  scopeBar?: React.ReactNode;
  /** e.g. "Cohort 2" or "All cohorts" */
  scopeLabel?: string;
  /** Show the "All time" (lifetime totals as of the latest upload) view instead of a week. */
  viewAll?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatMonth(dateStr: string) {
  return `Week of ${new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
}
function formatMonthShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}
function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function delta(n: number) {
  const abs = Math.abs(n).toLocaleString();
  if (n > 0) return <span className="text-xs font-semibold text-emerald-500">↑{abs}</span>;
  if (n < 0) return <span className="text-xs font-semibold text-rose-500">↓{abs}</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, deltaVal,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent: string; deltaVal?: number;
}) {
  return (
    <Card className="gap-3 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {deltaVal !== undefined && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          vs prev week: {delta(deltaVal)}
        </div>
      )}
    </Card>
  );
}

const chartConfig = {
  monthly_hours: { label: "Monthly Hours", color: "var(--color-chart-primary)" },
  active_learners: { label: "Active Learners", color: "var(--color-chart-primary)" },
  dist1: { color: "var(--color-chart-primary)" },
  dist2: { color: "var(--color-chart-primary)" },
  dist3: { color: "var(--color-chart-primary)" },
  dist4: { color: "var(--color-chart-primary)" },
  dist5: { color: "var(--color-chart-primary)" },
  dist6: { color: "var(--color-chart-primary)" },
};
const getDistColorVar = (i: number) => `var(--color-chart-primary)`;

// ── Main Component ────────────────────────────────────────────────────────────
export default function CourseraDashboardClient({ metrics, trend, selectedMonth, availableMonths, availableMonthLabels, basePath, queryParam, generatedAt, extraQuery, scopeBar, scopeLabel, viewAll = false }: Props) {
  const router = useRouter();

  const m = metrics;

  const firstImportMonth = availableMonths[availableMonths.length - 1];
  const periodOf = makePeriodLabeler(availableMonths);
  // The first upload is the lifetime baseline: no weekly values or week-over-week changes.
  const isBaseline = selectedMonth === firstImportMonth;
  const weeksCovered = Math.max(1, periodOf(selectedMonth).weeks);
  const latestEnd = new Date(`${selectedMonth}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(',', '');
  const isSecondMonth = availableMonths.length >= 2 && selectedMonth === availableMonths[availableMonths.length - 2];

  const isFirstImport = (monthStr: string) => {
    return monthStr === firstImportMonth;
  };

  const getLabel = (monthStr: string) => {
    if (availableMonthLabels && availableMonthLabels[monthStr]) return availableMonthLabels[monthStr];
    return periodOf(monthStr).label;
  };
  const getShortLabel = (monthStr: string) => {
    if (availableMonthLabels && availableMonthLabels[monthStr]) return availableMonthLabels[monthStr];
    return periodOf(monthStr).shortLabel;
  };

  // Distribution chart data
  const hoursDistData = Object.entries(m.hours_distribution ?? {}).map(([k, v]) => ({ name: k, value: v as number }));
  const progressDistData = Object.entries(m.progress_distribution ?? {}).map(([k, v]) => ({ name: k, value: v as number }));

  const trendWithLabel = trend
    .filter(t => t.month !== firstImportMonth)
    .map(t => ({ ...t, label: getShortLabel(t.month) }));

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        icon={BarChart3}
        description={
          <>
            {scopeLabel ? `${scopeLabel} · ` : ''}{viewAll ? `All time (up to ${latestEnd})` : getLabel(selectedMonth)}
            {typeof m.cohort_members_total === 'number' && (
              <> · {m.total_learners} of {m.cohort_members_total} members in this snapshot</>
            )}
            {' '}· Generated {new Date(generatedAt).toLocaleString()}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/activity-logs">Activity Logs</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/export">Export Report</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/import-reports">Import Reports</Link></Button>
          </>
        }
      >
        {scopeBar}
        {availableMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={viewAll ? 'default' : 'outline'}
              onClick={() => router.push(`${basePath ?? '/dashboard'}?view=all${extraQuery ? `&${extraQuery}` : ''}`)}
            >
              All time
            </Button>
            <Select
              value={viewAll ? undefined : selectedMonth}
              onValueChange={v => {
                const param = queryParam ?? 'month';
                router.push(`${basePath ?? '/dashboard'}?${param}=${v}${extraQuery ? `&${extraQuery}` : ''}`);
              }}
            >
              <SelectTrigger size="sm" className="min-w-72" aria-label="Week">
                <SelectValue placeholder="Pick a week…" />
              </SelectTrigger>
              <SelectContent>
                {[...availableMonths].sort().reverse().map(month => (
                  <SelectItem key={month} value={month}>{getLabel(month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PageHeader>

      {viewAll ? (
        <BaselineView
          m={m}
          label={`All time · lifetime up to ${latestEnd}`}
          note="Lifetime totals for this cohort as of the latest upload. Pick a week from the dropdown to see that week's figures."
          topTitle="Top Learners by Lifetime Hours"
        />
      ) : isBaseline ? (
        <BaselineView m={m} label={getLabel(selectedMonth)} />
      ) : (
      <>
      {/* Row 1: Learner KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Learners" value={fmt(m.total_learners)} icon={Users}
          accent="bg-indigo-500/10 text-indigo-500" />
        <KpiCard label="Active This Week" value={fmt(m.active_learners)} icon={Activity}
          accent="bg-emerald-500/10 text-emerald-500" deltaVal={isSecondMonth ? undefined : m.mom_active_learners} />
        <KpiCard label={weeksCovered > 1 ? `Hours (${weeksCovered} weeks)` : "Hours This Week"} value={`${fmt(m.monthly_hours, 1)}h`} icon={Clock}
          accent="bg-blue-500/10 text-blue-500"
          sub={`${fmt(m.avg_hours_per_active_learner, 1)}h avg per active`}
          deltaVal={isSecondMonth ? undefined : m.mom_monthly_hours} />
        <KpiCard label="Lifetime Hours" value={`${fmt(m.total_lifetime_hours, 0)}h`} icon={TrendingUp}
          accent="bg-violet-500/10 text-violet-500" />
      </div>

      {/* Row 2: Compliance + License KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Compliant Learners" value={fmt(m.compliant_learners)}
          sub={`≥${fmt(m.config?.minimum_monthly_hours, 1)}h this period`} icon={Shield}
          accent="bg-teal-500/10 text-teal-500" />
        <KpiCard label="Inactive This Week" value={fmt(m.inactive_learners)} icon={UserX}
          accent="bg-rose-500/10 text-rose-500" />
        <KpiCard label="Completions This Week" value={fmt(m.monthly_completions)} icon={CheckSquare}
          accent="bg-amber-500/10 text-amber-500" deltaVal={isSecondMonth ? undefined : m.mom_completions} />
        <KpiCard
          label="License Usage"
          value={m.license_utilization_pct !== null ? `${fmt(m.license_utilization_pct, 1)}%` : '—'}
          sub={m.total_licenses > 0 ? `${fmt(m.licenses_active)} / ${fmt(m.total_licenses)} licenses` : 'No license count set'}
          icon={Zap}
          accent="bg-cyan-500/10 text-cyan-500"
        />
      </div>

      {/* Row 3: Trend Charts */}
      {trendWithLabel.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="gap-0 p-5">
            <h3 className="text-sm font-semibold mb-4">Weekly Learning Hours</h3>
            <ChartContainer config={chartConfig} className="w-full h-[200px]">
              <BarChart data={trendWithLabel} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="monthly_hours" name="Hours" fill="var(--color-monthly_hours)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Card>
          <Card className="gap-0 p-5">
            <h3 className="text-sm font-semibold mb-4">Active Learners</h3>
            <ChartContainer config={chartConfig} className="w-full h-[200px]">
              <LineChart data={trendWithLabel}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="active_learners" name="Active" stroke="var(--color-active_learners)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-active_learners)' }} />
              </LineChart>
            </ChartContainer>
          </Card>
        </div>
      )}

      {/* Row 4: Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold mb-4">Hours Distribution This Week</h3>
          <ChartContainer config={chartConfig} className="w-full h-[200px]">
            <BarChart data={hoursDistData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" name="Learners" radius={[4, 4, 0, 0]}>
                {hoursDistData.map((_, i) => <Cell key={i} fill={getDistColorVar(i)} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>
        <Card className="gap-0 p-5">
          <h3 className="text-sm font-semibold mb-4">Progress Distribution</h3>
          <ChartContainer config={chartConfig} className="w-full h-[200px]">
            <BarChart data={progressDistData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" name="Learners" radius={[4, 4, 0, 0]}>
                {progressDistData.map((_, i) => <Cell key={i} fill={getDistColorVar(i)} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      {/* Row 5: Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Learners */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Top Learners This Week</h3>
          </div>
          <div className="divide-y divide-border/40">
            {(m.top_learners_by_hours ?? []).slice(0, 10).map((l: { email: string; name: string; monthly_hours: number; cumulative_hours: number }, i: number) => (
              <Link
                key={l.email}
                href={`/learners/${encodeURIComponent(l.email)}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{l.name || l.email}</div>
                  <div className="text-xs text-muted-foreground">{fmt(l.cumulative_hours, 1)}h lifetime</div>
                </div>
                <span className="text-sm font-bold text-indigo-500 tabular-nums">{fmt(l.monthly_hours, 1)}h</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Needs Intervention */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold">Needs Intervention</h3>
          </div>
          <div className="divide-y divide-border/40">
            {(m.learners_below_target ?? []).slice(0, 10).length > 0 ? (
              (m.learners_below_target ?? []).slice(0, 10).map((l: { email: string; name: string; monthly_hours: number }) => (
                <Link
                  key={l.email}
                  href={`/learners/${encodeURIComponent(l.email)}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.name || l.email}</div>
                    <div className="text-xs text-muted-foreground">{fmt(l.monthly_hours, 1)}h this week</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                    Below target
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                🎉 All active learners are on target this week
              </div>
            )}
          </div>
        </Card>
      </div>
      </>
      )}
    </PageShell>
  );
}

// ── Baseline (lifetime) view ──────────────────────────────────────────────────
// The first upload is everything learned up to the baseline Sunday. It is not a
// week, so only lifetime totals are shown: no weekly hours, "active this week"
// or changes. Weekly numbers start with the next upload.
function BaselineView({ m, label, note, topTitle }: { m: Metrics; label: string; note?: string; topTitle?: string }) {
  const learners = Number(m.total_learners) || 0;
  const lifetime = Number(m.total_lifetime_hours) || 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-muted-foreground">
            {note ?? 'This is the starting point: everything learned on Coursera up to this date. It is not a weekly report, so no weekly hours, active learners or changes are shown. Weekly figures start from the next upload, measured against this baseline.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Learners on Coursera" value={fmt(learners)} icon={Users} accent="bg-indigo-500/10 text-indigo-500" />
        <KpiCard label="Lifetime Hours" value={`${fmt(lifetime, 0)}h`} icon={TrendingUp} accent="bg-violet-500/10 text-violet-500"
          sub={learners ? `${fmt(lifetime / learners, 1)}h per learner` : undefined} />
        <KpiCard label="Courses Enrolled" value={fmt(m.total_courses_enrolled)} icon={BookOpen} accent="bg-blue-500/10 text-blue-500" />
        <KpiCard label="Courses Completed" value={fmt(m.total_courses_completed)} icon={CheckSquare} accent="bg-amber-500/10 text-amber-500"
          sub={`${fmt(m.overall_completion_rate, 1)}% completion rate`} />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
          <Award className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">{topTitle ?? 'Top Learners by Lifetime Hours (up to baseline)'}</h3>
        </div>
        <div className="divide-y divide-border/40">
          {(m.top_learners_by_cumulative ?? []).slice(0, 10).map((l: { email: string; name: string; cumulative_hours: number }, i: number) => (
            <Link key={l.email} href={`/learners/${encodeURIComponent(l.email)}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/30">
              <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1 truncate text-sm font-medium">{l.name || l.email}</div>
              <span className="text-sm font-bold tabular-nums text-indigo-500">{fmt(l.cumulative_hours, 1)}h</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
