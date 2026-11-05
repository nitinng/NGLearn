import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Activity, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { PageShell, PageHeader } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LinkSelect } from './_components/LinkSelect';
import { denyUnlessAccess } from '@/lib/guard';
import { listCohortOptions, resolveCohort, scopedLearnerQuery } from '@/lib/cohort-scope';
import { CohortPicker } from '@/components/cohort-picker';
import { makePeriodLabeler } from '@/lib/report-periods';

interface SearchParams {
  month?: string;
  cohort?: string;
  search?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 50;


export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const denied = await denyUnlessAccess('data_management.coursera_activity_logs', 'view', { backHref: '/dashboard', backLabel: 'Back to Dashboard' });
  if (denied) return denied;

  const { month: monthParam, cohort: cohortParam, search = '', status = 'all', page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createAdminClient(); // reads run after the access check above

  // Get available months for the selector
  const { data: monthsList } = await supabase
    .from('coursera_computed_metrics')
    .select('month')
    .order('month', { ascending: false });

  const firstImportMonth = monthsList?.[monthsList.length - 1]?.month;
  const periodOf = makePeriodLabeler((monthsList ?? []).map(m => m.month as string));
  const selectedMonth = monthParam ?? monthsList?.[0]?.month ?? null;

  // Only cohort members are listed (full reports are stored; filtering happens here).
  const cohorts = await listCohortOptions(supabase);
  const cohortId = resolveCohort(cohortParam, cohorts);
  const scopeLabel = cohortId ? cohorts.find(c => c.id === cohortId)!.name : 'All cohorts';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = scopedLearnerQuery(supabase, cohortId, '*', { count: 'exact' });

  if (selectedMonth) {
    query = query.eq('month', selectedMonth);
  }

  if (search) {
    // Strip characters that have meaning in PostgREST filter syntax.
    const term = search.replace(/[,()*%\\]/g, ' ').trim();
    if (term) query = query.or(`full_name.ilike.%${term}%,name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  // Status filter mapping
  // The first snapshot is the lifetime baseline: no weekly hours/active/target values.
  const isBaseline = !!selectedMonth && selectedMonth === firstImportMonth;
  const effectiveStatus = isBaseline && ['active', 'inactive', 'below_target'].includes(status) ? 'all' : status;
  switch (effectiveStatus) {
    case 'active':         query = query.eq('is_active', true); break;
    case 'inactive':       query = query.eq('is_active', false); break;
    case 'below_target':   query = query.eq('is_active', true).eq('is_compliant', false); break;
    case 'no_activity_30': query = query.gte('days_since_activity', 30); break;
    case 'no_activity_90': query = query.gte('days_since_activity', 90); break;
  }

  query = query
    .order(isBaseline ? 'cumulative_hours' : 'monthly_hours', { ascending: false })
    .order('email')
    .range(offset, offset + PAGE_SIZE - 1);

  const { data: learners, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Build URL with updated params
  function buildUrl(overrides: Partial<SearchParams>) {
    const params = new URLSearchParams();
    const merged = { month: selectedMonth ?? '', cohort: cohortId ?? '', search, status, page: String(page), ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/activity-logs?${params.toString()}`;
  }

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active', weekly: true },
    { value: 'inactive', label: 'Inactive', weekly: true },
    { value: 'below_target', label: 'Below Target', weekly: true },
    { value: 'no_activity_30', label: 'No Activity 30d' },
    { value: 'no_activity_90', label: 'No Activity 90d' },
  ].filter(opt => !(isBaseline && opt.weekly));

  return (
    <PageShell className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <PageHeader
        title="Activity Logs"
        icon={Activity}
        back={{ href: '/dashboard', label: 'Dashboard' }}
        description={<>{scopeLabel} · {selectedMonth ? periodOf(selectedMonth).label : 'All snapshots'} · {(count ?? 0).toLocaleString()} learners</>}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/export">
              <FileDown className="w-4 h-4" />
              Export Report
            </Link>
          </Button>
        }
      >
        <CohortPicker
          cohorts={cohorts}
          selected={cohortId}
          hrefFor={id => buildUrl({ cohort: id === 'all' ? '' : id, page: '1' })}
        />
        {(monthsList ?? []).length > 0 && (
          <LinkSelect
            ariaLabel="Week"
            className="min-w-72"
            value={selectedMonth ?? undefined}
            items={(monthsList ?? []).map(m => ({
              value: m.month as string,
              label: periodOf(m.month).label,
              href: buildUrl({ month: m.month as string, page: '1' }),
            }))}
          />
        )}
      </PageHeader>

      {isBaseline && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Baseline:</strong> lifetime totals up to this date, not a week. Weekly hours,
          active and on-target status start from the next upload.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form action="/activity-logs" method="get" className="flex gap-2">
          {selectedMonth && <input type="hidden" name="month" value={selectedMonth} />}
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {cohortId && <input type="hidden" name="cohort" value={cohortId} />}
          <Input
            name="search"
            defaultValue={search}
            placeholder="Search name or email…"
            className="w-56"
          />
          <Button type="submit" variant="outline">Search</Button>
          {search && (
            <Button asChild variant="ghost">
              <Link href={buildUrl({ search: '', page: '1' })}>Clear</Link>
            </Button>
          )}
        </form>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {statusOptions.map(opt => (
            <Button key={opt.value} asChild size="sm" variant={status === opt.value ? 'default' : 'outline'} className="rounded-full">
              <Link href={buildUrl({ status: opt.value, page: '1' })}>{opt.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden py-0">
        {!selectedMonth ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No data imported yet.</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Email</TableHead>
                {!isBaseline && <TableHead className="px-4 text-right">Weekly h</TableHead>}
                <TableHead className="px-4 text-right">Cumulative h</TableHead>
                <TableHead className="px-4 text-right">Courses</TableHead>
                <TableHead className="px-4 text-right">Completed</TableHead>
                {!isBaseline && <TableHead className="px-4 text-center">Active</TableHead>}
                {!isBaseline && <TableHead className="px-4 text-center">On Target</TableHead>}
                <TableHead className="px-4 text-right">Days Inactive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(learners ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No learners match your filters.</TableCell>
                </TableRow>
              ) : (
                (learners ?? []).map((l: {
                  email: string; name: string | null; full_name?: string | null;
                  monthly_hours: number; cumulative_hours: number;
                  courses_enrolled: number; courses_completed: number;
                  is_active: boolean; is_compliant: boolean; days_since_activity: number | null;
                }) => (
                  <TableRow key={l.email}>
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/learners/${encodeURIComponent(l.email)}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {l.full_name ?? l.name ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground text-xs">{l.email}</TableCell>
                    {!isBaseline && <TableCell className="px-4 py-3 text-right tabular-nums font-medium">{Number(l.monthly_hours).toFixed(1)}</TableCell>}
                    <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(l.cumulative_hours).toFixed(1)}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">{l.courses_enrolled}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">{l.courses_completed}</TableCell>
                    {!isBaseline && (
                      <TableCell className="px-4 py-3 text-center">
                        <Badge variant={l.is_active ? 'default' : 'secondary'}>{l.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                    )}
                    {!isBaseline && (
                      <TableCell className="px-4 py-3 text-center">
                        <Badge variant={l.is_compliant ? 'default' : 'outline'}>{l.is_compliant ? 'Yes' : 'No'}</Badge>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {l.days_since_activity !== null ? l.days_since_activity : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {(count ?? 0).toLocaleString()} total
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={buildUrl({ page: String(page - 1) })}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={buildUrl({ page: String(page + 1) })}>
                  Next <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
