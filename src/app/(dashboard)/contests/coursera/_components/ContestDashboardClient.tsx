'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  Users, Activity, Clock, CheckSquare, Trophy, Award, Medal, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { publishContestReport, getPublishedReportByContestId, republishContestReport } from '@/app/actions/reports';

// ── Types ────────────────────────────────────────────────────────────────────
interface LearnerStat {
  email: string;
  name: string | null;
  period_hours: number;
  cumulative_hours: number;
  courses_enrolled: number;
  courses_completed: number;
  new_completions: number;
  is_active: boolean;
  is_compliant: boolean;
  days_since_activity: number | null;
  group_name: string | null;
  team: string | null;
}

interface Props {
  stats: LearnerStat[];
  groups: string[];
  teams: string[];
  contestLabel: string;
  generatedAt: string;
  selectedContestId: string;
  availableContests: { id: string; label: string }[];
  importHref: string;
  activityHref: string;
  minHours: number;
  startDate?: string;
  endDate?: string;
  seriesName?: string;
  subContestName?: string;
  isPublicView?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function computeKPIs(stats: LearnerStat[]) {
  const total = stats.length;
  const active = stats.filter(s => s.is_active).length;
  const compliant = stats.filter(s => s.is_compliant).length;
  const hours = stats.reduce((s, r) => s + Number(r.period_hours), 0);
  const completions = stats.reduce((s, r) => s + Number(r.new_completions), 0);
  const avgHours = active > 0 ? hours / active : 0;
  return { total, active, inactive: total - active, compliant, hours, completions, avgHours };
}

// ── Medal colors ─────────────────────────────────────────────────────────────
const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32']; // gold, silver, bronze

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}
        style={{ backgroundColor: MEDAL_COLORS[rank - 1] }}>
        {rank}
      </div>
    );
  }
  return <span className="w-7 text-center text-xs font-bold text-muted-foreground tabular-nums shrink-0">{rank}</span>;
}

// ── Toggle Switch Component ──────────────────────────────────────────────────
function RankToggle({ mode, setMode }: { mode: 'hours' | 'certs'; setMode: (m: 'hours' | 'certs') => void }) {
  return (
    <div className="flex bg-muted/50 p-1 rounded-lg border border-border/60">
      <button
        onClick={() => setMode('hours')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'hours' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Rank by Hours
      </button>
      <button
        onClick={() => setMode('certs')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'certs' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Rank by Certs
      </button>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${accent}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Leaderboard Table ────────────────────────────────────────────────────────
function LeaderboardTable({ stats, showGroup = false, showTeam = true, limit }: {
  stats: LearnerStat[]; showGroup?: boolean; showTeam?: boolean; limit?: number;
}) {
  const [rankingMode, setRankingMode] = useState<'hours' | 'certs'>('hours');

  const sorted = [...stats].sort((a, b) => {
    if (rankingMode === 'certs') {
      if (b.new_completions !== a.new_completions) return b.new_completions - a.new_completions;
      return Number(b.period_hours) - Number(a.period_hours);
    } else {
      if (Number(b.period_hours) !== Number(a.period_hours)) return Number(b.period_hours) - Number(a.period_hours);
      return b.new_completions - a.new_completions;
    }
  });
  const display = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="flex flex-col">
      <div className="px-5 py-3 border-b border-border/60 bg-muted/10 flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-medium">Sorted by {rankingMode === 'hours' ? 'Period Hours' : 'Certifications'}</span>
        <RankToggle mode={rankingMode} setMode={setRankingMode} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="text-center px-3 py-3 font-medium text-muted-foreground w-12">#</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Learner</th>
              {showGroup && <th className="text-left px-3 py-3 font-medium text-muted-foreground">Group</th>}
              {showTeam && <th className="text-left px-3 py-3 font-medium text-muted-foreground">Team</th>}
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Period Hours</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Certifications</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Active</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No learners found.</td></tr>
            ) : display.map((l, i) => (
              <tr key={l.email} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                <td className="px-3 py-3 text-center"><RankBadge rank={i + 1} /></td>
                <td className="px-3 py-3">
                  <div className="font-medium text-sm">{l.name ?? l.email}</div>
                </td>
                {showGroup && <td className="px-3 py-3 text-sm text-muted-foreground">{l.group_name ? `Group ${l.group_name}` : '—'}</td>}
                {showTeam && <td className="px-3 py-3 text-sm text-muted-foreground">{l.team ?? '—'}</td>}
                <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(Number(l.period_hours), 1)}h</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{l.new_completions}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${l.is_active ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Group Ranking Card ───────────────────────────────────────────────────────
function GroupRankingCard({ groupName, stats, rank }: { groupName: string; stats: LearnerStat[]; rank: number }) {
  const [rankingMode, setRankingMode] = useState<'hours' | 'certs'>('hours');
  const kpis = computeKPIs(stats);
  
  const sorted = [...stats].sort((a, b) => {
    if (rankingMode === 'certs') {
      if (b.new_completions !== a.new_completions) return b.new_completions - a.new_completions;
      return Number(b.period_hours) - Number(a.period_hours);
    } else {
      if (Number(b.period_hours) !== Number(a.period_hours)) return Number(b.period_hours) - Number(a.period_hours);
      return b.new_completions - a.new_completions;
    }
  });
  const top3 = sorted.slice(0, 3);

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RankBadge rank={rank} />
          <h3 className="text-sm font-bold">Group {groupName}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{kpis.total} members</span>
      </div>
      <div className="px-5 py-3 grid grid-cols-3 gap-3 border-b border-border/40 bg-muted/20">
        <div className="text-center">
          <div className="text-lg font-bold">{fmt(kpis.hours, 1)}h</div>
          <div className="text-xs text-muted-foreground">Total Hours</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{fmt(kpis.completions)}</div>
          <div className="text-xs text-muted-foreground">Certs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{fmt(kpis.total > 0 ? (kpis.active / kpis.total) * 100 : 0)}%</div>
          <div className="text-xs text-muted-foreground">% Active</div>
        </div>
      </div>
      <div className="px-4 py-2 border-b border-border/40 flex justify-end">
        <RankToggle mode={rankingMode} setMode={setRankingMode} />
      </div>
      <div className="divide-y divide-border/40 flex-1">
        {top3.map((l, i) => (
          <div key={l.email} className="flex items-center gap-3 px-5 py-2.5">
            <RankBadge rank={i + 1} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{l.name ?? l.email}</div>
              <div className="text-xs text-muted-foreground">{l.team ?? '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-indigo-500 tabular-nums">{fmt(Number(l.period_hours), 1)}h</div>
              <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{l.new_completions} certs</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Team Per Group Card ──────────────────────────────────────────────────
function TopTeamsPerGroupCard({ stats, groups }: { stats: LearnerStat[]; groups: string[] }) {
  const [rankingMode, setRankingMode] = useState<'hours' | 'certs'>('hours');

  // Compute top team for each group
  const groupTopTeams = groups.map(g => {
    const groupStats = stats.filter(s => s.group_name === g);
    const groupTeams = [...new Set(groupStats.map(s => s.team).filter(Boolean))] as string[];
    
    if (groupTeams.length === 0) return null;

    const teamData = groupTeams.map(t => {
      const teamStats = groupStats.filter(s => s.team === t);
      const teamKpis = computeKPIs(teamStats);
      const topPerformer = [...teamStats].sort((a, b) => Number(b.period_hours) - Number(a.period_hours))[0];
      return { name: t, ...teamKpis, topPerformer };
    }).sort((a, b) => {
      if (rankingMode === 'certs') {
        if (b.completions !== a.completions) return b.completions - a.completions;
        return b.hours - a.hours;
      } else {
        if (b.hours !== a.hours) return b.hours - a.hours;
        return b.completions - a.completions;
      }
    });

    return { group: g, topTeam: teamData[0] };
  }).filter(Boolean) as { group: string; topTeam: any }[];

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-cyan-500" />
          <h3 className="text-base font-bold">Top Team in Each Group</h3>
        </div>
        <RankToggle mode={rankingMode} setMode={setRankingMode} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-24">Group</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Top Team</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Members</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Total Hours</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Certs</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">% Active</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Team MVP</th>
            </tr>
          </thead>
          <tbody>
            {groupTopTeams.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No teams found in groups.</td></tr>
            ) : groupTopTeams.map(({ group, topTeam }) => (
              <tr key={group} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                <td className="px-3 py-3 font-bold text-muted-foreground">Group {group}</td>
                <td className="px-3 py-3 font-semibold text-primary">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    {topTeam.name}
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{topTeam.total}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(topTeam.hours, 1)}h</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{topTeam.completions}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                  {fmt(topTeam.total > 0 ? (topTeam.active / topTeam.total) * 100 : 0, 1)}%
                </td>
                <td className="px-3 py-3">
                  {topTeam.topPerformer ? (
                    <div>
                      <span className="text-sm">{topTeam.topPerformer.name ?? topTeam.topPerformer.email}</span>
                      <span className="text-xs text-indigo-500 ml-2 font-medium">{fmt(Number(topTeam.topPerformer.period_hours), 1)}h</span>
                    </div>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Team MVPs Card ───────────────────────────────────────────────────────────
function TeamMVPsCard({ stats, teams }: { stats: LearnerStat[]; teams: string[] }) {
  const [rankingMode, setRankingMode] = useState<'hours' | 'certs'>('hours');

  // Compute top performer for each team
  const teamMVPs = teams.map(t => {
    const teamStats = stats.filter(s => s.team === t);
    if (teamStats.length === 0) return null;
    
    const sorted = [...teamStats].sort((a, b) => {
      if (rankingMode === 'certs') {
        if (b.new_completions !== a.new_completions) return b.new_completions - a.new_completions;
        return Number(b.period_hours) - Number(a.period_hours);
      } else {
        if (Number(b.period_hours) !== Number(a.period_hours)) return Number(b.period_hours) - Number(a.period_hours);
        return b.new_completions - a.new_completions;
      }
    });

    return { team: t, mvp: sorted[0], group: sorted[0].group_name };
  }).filter(Boolean) as { team: string; mvp: LearnerStat; group: string }[];

  // sort teams by MVP's performance to make the table ordered
  teamMVPs.sort((a, b) => {
    if (rankingMode === 'certs') {
      if (b.mvp.new_completions !== a.mvp.new_completions) return b.mvp.new_completions - a.mvp.new_completions;
      return Number(b.mvp.period_hours) - Number(a.mvp.period_hours);
    } else {
      if (Number(b.mvp.period_hours) !== Number(a.mvp.period_hours)) return Number(b.mvp.period_hours) - Number(a.mvp.period_hours);
      return b.mvp.new_completions - a.mvp.new_completions;
    }
  });

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-bold">Team MVPs</h3>
        </div>
        <RankToggle mode={rankingMode} setMode={setRankingMode} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="text-center px-3 py-3 font-medium text-muted-foreground w-12">#</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">MVP</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Team</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Group</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Period Hours</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground">Certifications</th>
            </tr>
          </thead>
          <tbody>
            {teamMVPs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No MVPs found.</td></tr>
            ) : teamMVPs.map(({ team, mvp, group }, i) => (
              <tr key={team} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                <td className="px-3 py-3 text-center"><RankBadge rank={i + 1} /></td>
                <td className="px-3 py-3 font-medium">{mvp.name ?? mvp.email}</td>
                <td className="px-3 py-3 text-muted-foreground">{team}</td>
                <td className="px-3 py-3 text-muted-foreground">{group ? `Group ${group}` : '—'}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(Number(mvp.period_hours), 1)}h</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{mvp.new_completions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── All Tab Content ──────────────────────────────────────────────────────────
function AllTabContent({ stats, groups, teams }: { stats: LearnerStat[]; groups: string[]; teams: string[] }) {
  const kpis = computeKPIs(stats);

  // Group rankings sorted by total hours
  const groupData = groups.map(g => {
    const groupStats = stats.filter(s => s.group_name === g);
    const groupKpis = computeKPIs(groupStats);
    return { name: g, stats: groupStats, ...groupKpis };
  }).sort((a, b) => b.hours - a.hours);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Members" value={fmt(kpis.total)} icon={Users} accent="bg-indigo-500/10 text-indigo-500" />
        <KpiCard label="Active Members" value={fmt(kpis.active)} icon={Activity} accent="bg-emerald-500/10 text-emerald-500" sub={`${fmt(kpis.total > 0 ? (kpis.active / kpis.total) * 100 : 0)}% active`} />
        <KpiCard label="Total Period Hours" value={`${fmt(kpis.hours, 1)}h`} icon={Clock} accent="bg-blue-500/10 text-blue-500" sub={`${fmt(kpis.avgHours, 1)}h avg per active`} />
        <KpiCard label="Certifications completed" value={fmt(kpis.completions)} icon={CheckSquare} accent="bg-amber-500/10 text-amber-500" />
      </div>

      {/* Overall Leaderboard */}
      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold">Overall Leaderboard</h3>
          <span className="text-xs text-muted-foreground ml-auto">Top 20</span>
        </div>
        <LeaderboardTable stats={stats} showGroup showTeam limit={20} />
      </div>

      {/* Group Rankings */}
      {groupData.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold">Group Rankings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupData.map((g, i) => (
              <GroupRankingCard key={g.name} groupName={g.name} stats={g.stats} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Team Rankings (Top Team in Each Group) */}
      {groups.length > 0 && (
        <TopTeamsPerGroupCard stats={stats} groups={groups} />
      )}

      {/* Team MVPs */}
      {teams.length > 0 && (
        <TeamMVPsCard stats={stats} teams={teams} />
      )}
    </div>
  );
}

// ── Group Tab Content ────────────────────────────────────────────────────────
function GroupTabContent({ groupName, stats, teams }: { groupName: string; stats: LearnerStat[]; teams: string[] }) {
  const groupStats = stats.filter(s => s.group_name === groupName);
  const kpis = computeKPIs(groupStats);

  const groupTeams = [...new Set(groupStats.map(s => s.team).filter(Boolean))] as string[];
  const teamData = groupTeams.map(t => {
    const teamStats = groupStats.filter(s => s.team === t);
    return { name: t, ...computeKPIs(teamStats) };
  }).sort((a, b) => b.hours - a.hours);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Members" value={fmt(kpis.total)} icon={Users} accent="bg-indigo-500/10 text-indigo-500" />
        <KpiCard label="Active" value={fmt(kpis.active)} icon={Activity} accent="bg-emerald-500/10 text-emerald-500" sub={`${fmt(kpis.total > 0 ? (kpis.active / kpis.total) * 100 : 0)}% active`} />
        <KpiCard label="Period Hours" value={`${fmt(kpis.hours, 1)}h`} icon={Clock} accent="bg-blue-500/10 text-blue-500" sub={`${fmt(kpis.avgHours, 1)}h avg per active`} />
        <KpiCard label="Certifications completed" value={fmt(kpis.completions)} icon={CheckSquare} accent="bg-amber-500/10 text-amber-500" />
      </div>

      {/* Full leaderboard */}
      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold">Group {groupName} Leaderboard</h3>
          <span className="text-xs text-muted-foreground ml-auto">{kpis.total} members</span>
        </div>
        <LeaderboardTable stats={groupStats} showTeam />
      </div>

      {/* Team breakdown */}
      {teamData.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
            <Medal className="w-5 h-5 text-cyan-500" />
            <h3 className="text-base font-bold">Teams in Group {groupName}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground w-12">#</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Team</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Members</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Total Hours</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Certs</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Active</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">% Active</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((t, i) => (
                  <tr key={t.name} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-3 text-center"><RankBadge rank={i + 1} /></td>
                    <td className="px-3 py-3 font-medium">{t.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.total}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(t.hours, 1)}h</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">{t.completions}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.active}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(t.total > 0 ? (t.active / t.total) * 100 : 0, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Teams Tab Content ────────────────────────────────────────────────────────
function TeamsTabContent({ stats, teams }: { stats: LearnerStat[]; teams: string[] }) {
  const [selectedTeam, setSelectedTeam] = useState(teams[0] ?? '');

  const teamStats = useMemo(() =>
    stats.filter(s => s.team === selectedTeam),
    [stats, selectedTeam]
  );
  const kpis = computeKPIs(teamStats);

  return (
    <div className="space-y-6">
      {/* Team selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Select Team:</span>
        <div className="relative">
          <select
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
            className="appearance-none bg-background border border-border/80 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition min-w-[200px]"
          >
            {teams.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {selectedTeam && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Members" value={fmt(kpis.total)} icon={Users} accent="bg-indigo-500/10 text-indigo-500" />
            <KpiCard label="Active" value={fmt(kpis.active)} icon={Activity} accent="bg-emerald-500/10 text-emerald-500" sub={`${fmt(kpis.total > 0 ? (kpis.active / kpis.total) * 100 : 0)}% active`} />
            <KpiCard label="Period Hours" value={`${fmt(kpis.hours, 1)}h`} icon={Clock} accent="bg-blue-500/10 text-blue-500" sub={`${fmt(kpis.avgHours, 1)}h avg per active`} />
            <KpiCard label="Certifications completed" value={fmt(kpis.completions)} icon={CheckSquare} accent="bg-amber-500/10 text-amber-500" />
          </div>

          {/* Leaderboard */}
          <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold">{selectedTeam} Leaderboard</h3>
              <span className="text-xs text-muted-foreground ml-auto">{kpis.total} members</span>
            </div>
            <LeaderboardTable stats={teamStats} showGroup showTeam={false} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ContestDashboardClient(props: Props) {
  const {
    stats, groups, teams, contestLabel, generatedAt, selectedContestId,
    availableContests, importHref, activityHref, minHours,
    startDate, endDate, seriesName, subContestName, isPublicView
  } = props;
  
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (isPublicView) return;
    async function checkExisting() {
      const data = await getPublishedReportByContestId(selectedContestId);
      if (data) {
        setExistingReportId(data.id);
      } else {
        setExistingReportId(null);
      }
    }
    checkExisting();
  }, [selectedContestId, isPublicView]);

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const title = seriesName && subContestName 
        ? `Contest Analytics - ${seriesName} - ${subContestName}`
        : `Contest Analytics - ${contestLabel}`;
        
      const payload = { ...props, isPublicView: true };
      
      const id = await publishContestReport(title, payload);
      toast.success('Report published successfully!');
      router.push('/published-reports');
    } catch (error) {
      toast.error('Failed to publish report.');
      console.error(error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRepublish = async () => {
    if (!existingReportId) return;
    try {
      setIsPublishing(true);
      const title = seriesName && subContestName 
        ? `Contest Analytics - ${seriesName} - ${subContestName}`
        : `Contest Analytics - ${contestLabel}`;
        
      const payload = { ...props, isPublicView: true };
      
      await republishContestReport(existingReportId, title, payload);
      toast.success('Report republished successfully!');
    } catch (error) {
      toast.error('Failed to republish report.');
      console.error(error);
    } finally {
      setIsPublishing(false);
    }
  };

  const tabs = useMemo(() => {
    const t: { key: string; label: string }[] = [{ key: 'all', label: 'All' }];
    for (const g of groups) {
      t.push({ key: `group-${g}`, label: `Group ${g}` });
    }
    if (teams.length > 0) {
      t.push({ key: 'teams', label: 'Teams' });
    }
    t.push({ key: 'inactive', label: 'Inactive' });
    return t;
  }, [groups, teams]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🏆 Contest Analytics</h1>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap mt-3">
            <span className="text-lg font-bold text-foreground">
              {seriesName || contestLabel.split(' - ')[0]}
            </span>
            <span className="text-muted-foreground font-bold">-</span>
            <div className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-lg border border-primary/20">
              {subContestName || contestLabel.split(' - ')[1] || 'Contest'}
            </div>
            
            <span className="text-muted-foreground font-bold">|</span>
            
            {(startDate || endDate) && (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/20">
                  {startDate ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </div>
                <span className="text-muted-foreground font-medium">-</span>
                <div className="inline-flex items-center px-3 py-1 bg-pink-500/10 text-pink-600 dark:text-pink-400 text-sm font-medium rounded-lg border border-pink-500/20">
                  {endDate ? new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </div>
              </div>
            )}
          </div>

          {isPublicView && (
            <p className="text-muted-foreground text-xs mt-3">
              Published {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {!isPublicView && (
          <div className="flex items-center gap-2">
            {existingReportId ? (
              <>
                <a
                  href={`/p/${existingReportId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-4 py-2 rounded-lg border border-border/80 bg-accent/50 text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  Published
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
                <button 
                  onClick={handleRepublish}
                  disabled={isPublishing}
                  className="text-sm px-4 py-2 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {isPublishing ? 'Publishing...' : 'Republish'}
                </button>
              </>
            ) : (
              <button 
                onClick={handlePublish}
                disabled={isPublishing}
                className="text-sm px-4 py-2 rounded-lg border border-border/80 hover:bg-accent transition-colors disabled:opacity-50"
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>
            )}
            <Link href={activityHref} className="text-sm px-4 py-2 rounded-lg border border-border/80 hover:bg-accent transition-colors">
              Activity Logs
            </Link>
            <Link href={importHref} className="text-sm px-4 py-2 rounded-lg border border-border/80 hover:bg-accent transition-colors">
              Import Reports
            </Link>
          </div>
        )}
      </div>

      {/* Contest Selector */}
      {!isPublicView && availableContests.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {availableContests.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/contests/coursera?contest=${c.id}`)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                c.id === selectedContestId
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/80 hover:bg-accent'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl border border-border/60 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        <AllTabContent stats={stats} groups={groups} teams={teams} />
      )}
      {activeTab.startsWith('group-') && (
        <GroupTabContent groupName={activeTab.replace('group-', '')} stats={stats} teams={teams} />
      )}
      {activeTab === 'teams' && (
        <TeamsTabContent stats={stats} teams={teams} />
      )}
      {activeTab === 'inactive' && (
        <InactiveTabContent stats={stats} />
      )}
    </div>
  );
}

// ── Inactive Tab Content ─────────────────────────────────────────────────────
function InactiveTabContent({ stats }: { stats: LearnerStat[] }) {
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  
  // 1. Chart Data
  const teamNames = [...new Set(stats.map(s => s.team).filter(Boolean))] as string[];
  const chartData = teamNames.map(team => {
    const teamStats = stats.filter(s => s.team === team);
    const total = teamStats.length;
    const inactive = teamStats.filter(s => !s.is_active).length;
    return {
      team,
      teamShort: team.length > 15 ? team.substring(0, 15) + '…' : team,
      inactive,
      total,
      percentage: total > 0 ? Number(((inactive / total) * 100).toFixed(1)) : 0
    };
  }).sort((a, b) => b.percentage - a.percentage);

  // 2. Table Data
  let filteredStats = stats.filter(s => !s.is_active);
  if (selectedTeam !== 'all') {
    filteredStats = filteredStats.filter(s => s.team === selectedTeam);
  }

  // Sort inactive learners by days_since_activity (descending, so longest inactive first)
  filteredStats.sort((a, b) => {
    if (a.days_since_activity === null && b.days_since_activity === null) return 0;
    if (a.days_since_activity === null) return 1; // nulls at the bottom
    if (b.days_since_activity === null) return -1;
    return b.days_since_activity - a.days_since_activity;
  });

  return (
    <div className="space-y-6">
      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden p-5">
          <h3 className="text-sm font-semibold mb-4">Inactive Members per Team</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="teamShort" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `${v}%`} />
              <Tooltip 
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
                      <div className="font-medium mb-2">{data.team}</div>
                      <div className="text-rose-500 font-semibold">{data.percentage}% Inactive</div>
                      <div className="text-muted-foreground text-xs mt-1">{data.inactive} out of {data.total} members</div>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="left" dataKey="percentage" name="% Inactive" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.percentage > 50 ? '#ef4444' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold">Inactive Members</h3>
            <span className="text-xs text-muted-foreground ml-2">{filteredStats.length} members</span>
          </div>
          
          <div className="relative">
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              className="appearance-none bg-background border border-border/80 rounded-lg px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition min-w-[150px]"
            >
              <option value="all">All Teams</option>
              {teamNames.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Learner</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Group</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Team</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days Inactive</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No inactive learners found.</td></tr>
              ) : filteredStats.map(l => (
                <tr key={l.email} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{l.name ?? l.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{l.group_name ? `Group ${l.group_name}` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{l.team ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-500 font-medium">
                    {l.days_since_activity !== null ? `${l.days_since_activity}d` : 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
