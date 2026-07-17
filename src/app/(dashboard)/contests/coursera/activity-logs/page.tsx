import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/roles';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSubContests } from '@/app/actions/contests';

interface SearchParams {
  contest?: string;
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export default async function ContestActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const role = await getUserRole();
  if (role === 'Member') redirect('/');

  const { contest: contestParam, search = '', status = 'all', page: pageParam, limit: limitParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const pageSize = parseInt(limitParam ?? '10', 10);
  const offset = (page - 1) * pageSize;

  const supabase = createAdminClient();

  // Get all sub-contests for the dropdown
  const subContests = await getSubContests();
  const contestLabels = subContests.reduce((acc, sc: any) => {
    acc[sc.id] = sc.contest_series?.name ? `${sc.contest_series.name} - ${sc.name}` : sc.name;
    return acc;
  }, {} as Record<string, string>);

  const selectedContest = contestParam ?? subContests?.[0]?.id ?? null;

  // 1. Fetch all ng_members
  const { data: members } = await supabase.from('ng_members').select('email, alt_email, full_name, team, group_name');

  // 2. Fetch all stats for this contest (paginated)
  let allLearnerStats: any[] = [];
  if (selectedContest) {
    let from = 0;
    const step = 1000;
    while (true) {
      const { data } = await supabase
        .from('contest_coursera_learner_stats')
        .select('*')
        .eq('sub_contest_id', selectedContest)
        .range(from, from + step - 1);
      if (!data || data.length === 0) break;
      allLearnerStats.push(...data);
      if (data.length < step) break;
      from += step;
    }
  }

  // 3. Join them in memory (show official and alt separately)
  const statsMap = new Map<string, any>();
  for (const s of allLearnerStats ?? []) {
    statsMap.set(s.email.toLowerCase().trim(), s);
  }

  let enrichedStats: any[] = [];
  for (const m of (members ?? [])) {
    const email = m.email.toLowerCase().trim();
    const sMain = statsMap.get(email);
    
    enrichedStats.push({
      email: email,
      is_alt: false,
      name: m.full_name || (sMain ? sMain.name : null),
      period_hours: sMain ? Number(sMain.period_hours) : 0,
      cumulative_hours: sMain ? Number(sMain.cumulative_hours) : 0,
      courses_enrolled: sMain ? Number(sMain.courses_enrolled) : 0,
      courses_completed: sMain ? Number(sMain.courses_completed) : 0,
      new_completions: sMain ? Number(sMain.new_completions) : 0,
      is_active: sMain ? sMain.is_active : false,
      is_compliant: sMain ? sMain.is_compliant : false,
      days_since_activity: sMain ? sMain.days_since_activity : null,
      team: m.team ?? null,
      group_name: m.group_name ?? null,
    });
    
    if (m.alt_email) {
      const altEmail = m.alt_email.toLowerCase().trim();
      const sAlt = statsMap.get(altEmail);
      enrichedStats.push({
        email: altEmail,
        is_alt: true,
        name: m.full_name || (sAlt ? sAlt.name : null),
        period_hours: sAlt ? Number(sAlt.period_hours) : 0,
        cumulative_hours: sAlt ? Number(sAlt.cumulative_hours) : 0,
        courses_enrolled: sAlt ? Number(sAlt.courses_enrolled) : 0,
        courses_completed: sAlt ? Number(sAlt.courses_completed) : 0,
        new_completions: sAlt ? Number(sAlt.new_completions) : 0,
        is_active: sAlt ? sAlt.is_active : false,
        is_compliant: sAlt ? sAlt.is_compliant : false,
        days_since_activity: sAlt ? sAlt.days_since_activity : null,
        team: m.team ?? null,
        group_name: m.group_name ?? null,
      });
    }
  }

  // 4. Apply Filters
  if (search) {
    const term = search.toLowerCase();
    enrichedStats = enrichedStats.filter(s => 
      s.email.toLowerCase().includes(term) || 
      (s.name && s.name.toLowerCase().includes(term))
    );
  }

  switch (status) {
    case 'active':       enrichedStats = enrichedStats.filter(s => s.is_active); break;
    case 'inactive':     enrichedStats = enrichedStats.filter(s => !s.is_active); break;
    case 'below_target': enrichedStats = enrichedStats.filter(s => s.is_active && !s.is_compliant); break;
  }

  // 5. Sort by period_hours descending
  enrichedStats.sort((a, b) => b.period_hours - a.period_hours);

  // 6. Paginate
  const count = enrichedStats.length;
  const totalPages = Math.ceil(count / pageSize);
  const learners = enrichedStats.slice(offset, offset + pageSize);

  // Build URL with updated params
  function buildUrl(overrides: Partial<SearchParams>) {
    const params = new URLSearchParams();
    const merged = { contest: selectedContest ?? '', search, status, page: String(page), limit: String(pageSize), ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    return `/contests/coursera/activity-logs?${params.toString()}`;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/contests/coursera${selectedContest ? `?contest=${selectedContest}` : ''}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Contest Activity Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {selectedContest ? contestLabels[selectedContest] ?? 'Contest' : 'All contests'} · {(count ?? 0).toLocaleString()} members
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Contest selector */}
        <form method="get" action="/contests/coursera/activity-logs" className="flex gap-2 items-center">
          {search && <input type="hidden" name="search" value={search} />}
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <input type="hidden" name="limit" value={pageSize} />
          <select
            name="contest"
            defaultValue={selectedContest ?? ''}
            className="bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          >
            {subContests.map((sc: any) => (
              <option key={sc.id} value={sc.id}>{contestLabels[sc.id]}</option>
            ))}
          </select>
          <button type="submit" className="px-3 py-2 rounded-lg border border-border/80 text-sm hover:bg-accent transition-colors">Filter</button>
        </form>

        {/* Search */}
        <form action="/contests/coursera/activity-logs" method="get" className="flex gap-2">
          {selectedContest && <input type="hidden" name="contest" value={selectedContest} />}
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <input type="hidden" name="limit" value={pageSize} />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name or email…"
            className="bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition w-56"
          />
          <button type="submit" className="px-3 py-2 rounded-lg border border-border/80 text-sm hover:bg-accent transition-colors">Search</button>
          {search && (
            <Link href={buildUrl({ search: '', page: '1' })} className="px-3 py-2 rounded-lg border border-border/80 text-sm hover:bg-accent transition-colors text-muted-foreground">
              Clear
            </Link>
          )}
        </form>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'below_target', label: 'Below Target' },
          ].map(opt => (
            <Link
              key={opt.value}
              href={buildUrl({ status: opt.value, page: '1' })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                status === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/80 hover:bg-accent'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden">
        {!selectedContest ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Select a contest to view activity logs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Period h</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cumulative h</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Courses</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Completed</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Compliant</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days Inactive</th>
                </tr>
              </thead>
              <tbody>
                {(learners ?? []).length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No members match your filters.</td></tr>
                ) : (
                  (learners ?? []).map((l: {
                    email: string; name: string | null; is_alt: boolean;
                    period_hours: number; cumulative_hours: number;
                    courses_enrolled: number; courses_completed: number;
                    is_active: boolean; is_compliant: boolean; days_since_activity: number | null;
                  }) => (
                    <tr key={l.email} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium">{l.name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs flex items-center gap-2">
                        {l.email}
                        {l.is_alt && (
                          <span className="text-[10px] uppercase bg-secondary/80 text-muted-foreground px-1.5 py-0.5 rounded-md border border-border/60">
                            Alt
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{Number(l.period_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(l.cumulative_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.courses_enrolled}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.courses_completed}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${l.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${l.is_compliant ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {l.days_since_activity !== null ? l.days_since_activity : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {((totalPages > 1) || (count ?? 0) > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {Math.max(1, totalPages)} · {(count ?? 0).toLocaleString()} total
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map(size => (
                  <Link
                    key={size}
                    href={buildUrl({ limit: String(size), page: '1' })}
                    className={`px-2 py-1 text-xs border rounded-lg transition-colors ${
                      pageSize === size
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-border/80'
                    }`}
                  >
                    {size}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/80 text-sm hover:bg-accent transition-colors">
                <ChevronLeft className="w-4 h-4" /> Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/80 text-sm hover:bg-accent transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
