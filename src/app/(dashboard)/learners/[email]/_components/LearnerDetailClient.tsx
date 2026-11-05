'use client';

import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from 'recharts';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { makePeriodLabeler } from '@/lib/report-periods';

interface MonthRecord {
  month: string;
  monthly_hours: number;
  cumulative_hours: number;
  courses_enrolled: number;
  courses_completed: number;
  is_active: boolean;
  is_compliant: boolean;
  days_since_activity: number | null;
}

interface Course {
  course_id: string;
  course_name: string | null;
  course_type: string | null;
  university: string | null;
  overall_progress: number;
  cumulative_learning_hours: number;
  estimated_course_hours: number | null;
  completed: boolean;
  last_activity_time: string | null;
  completion_time: string | null;
  course_slug: string | null;
  certificate_url: string | null;
}

interface Props {
  monthlyHistory: MonthRecord[];
  courses: Course[];
  /** All snapshot dates (any order), for "Week N" labels */
  snapshotDates?: string[];
}

function formatMonthShort(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const chartConfig = {
  monthly_hours: { label: "Hours", color: "var(--color-chart-primary)" },
};

function formatMonth(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function LearnerDetailClient({ monthlyHistory, courses, snapshotDates }: Props) {
  const [isCourseListExpanded, setIsCourseListExpanded] = useState(false);
  const firstMonth = monthlyHistory[0]?.month;
  const allDates = snapshotDates?.length ? snapshotDates : monthlyHistory.map(r => r.month);
  const periodOf = makePeriodLabeler(allDates);
  const baselineDate = [...allDates].sort()[0] ?? null;

  const chartData = monthlyHistory
    .filter(r => r.month !== (baselineDate ?? firstMonth))
    .map(r => ({
      label: periodOf(r.month).shortLabel,
      monthly_hours: r.monthly_hours,
      is_compliant: r.is_compliant,
    }));

  return (
    <div className="space-y-6">
      {/* Monthly Hours Chart */}
      <Card className="gap-0 p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Weekly Learning Hours & Compliance
        </h2>
        <ChartContainer config={chartConfig} className="w-full h-[220px]">
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.is_compliant ? "var(--color-chart-success)" : "var(--color-chart-warning)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Monthly table below chart */}
        <div className="mt-4">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="pr-4">Week</TableHead>
                <TableHead className="px-3 text-right">Weekly h</TableHead>
                <TableHead className="px-3 text-right">Cumulative h</TableHead>
                <TableHead className="px-3 text-center">Active</TableHead>
                <TableHead className="px-3 text-center">Compliant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...monthlyHistory].reverse().map(r => (
                <TableRow key={r.month}>
                  <TableCell className="py-2 pr-4">{periodOf(r.month).label}</TableCell>
                  <TableCell className="py-2 px-3 text-right tabular-nums">{r.month === baselineDate ? <span className="text-muted-foreground" title="Baseline: lifetime totals only">—</span> : Number(r.monthly_hours).toFixed(1)}</TableCell>
                  <TableCell className="py-2 px-3 text-right tabular-nums text-muted-foreground">{r.cumulative_hours.toFixed(1)}</TableCell>
                  <TableCell className="py-2 px-3 text-center">
                    {r.is_active
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                      : <XCircle className="w-3.5 h-3.5 text-rose-400 mx-auto" />}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-center">
                    {r.is_compliant
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                      : <XCircle className="w-3.5 h-3.5 text-amber-400 mx-auto" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Course List (Collapsible) */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Course List (Latest Snapshot)</h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              {courses.length} Courses
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCourseListExpanded(!isCourseListExpanded)}
            className="h-8 text-xs font-semibold gap-1 text-primary hover:bg-primary/10 rounded-lg px-2.5"
          >
            {isCourseListExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Collapse Course List
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> Expand Course List
              </>
            )}
          </Button>
        </div>

        {isCourseListExpanded && (
          <div>
            {courses.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No course data available.</div>
            ) : (
              <div>
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-left px-4 py-3 text-xs">Course</TableHead>
                      <TableHead className="text-left px-4 py-3 text-xs">Type</TableHead>
                      <TableHead className="text-right px-4 py-3 text-xs">Progress</TableHead>
                      <TableHead className="text-right px-4 py-3 text-xs">Hours</TableHead>
                      <TableHead className="text-center px-4 py-3 text-xs">Done</TableHead>
                      <TableHead className="text-left px-4 py-3 text-xs">Last Active</TableHead>
                      <TableHead className="text-left px-4 py-3 text-xs">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map(c => (
                      <TableRow key={c.course_id}>
                        <TableCell className="px-4 py-3">
                          <div className="font-medium text-xs text-foreground">{c.course_name ?? c.course_id}</div>
                          {c.university && <div className="text-[10px] text-muted-foreground">{c.university}</div>}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground text-xs">{c.course_type ?? '—'}</TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-border/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${Math.min(100, c.overall_progress)}%` }}
                              />
                            </div>
                            <span className="text-xs">{c.overall_progress.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums text-xs">{c.cumulative_learning_hours.toFixed(1)}h</TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          {c.completed
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                          {c.last_activity_time
                            ? new Date(c.last_activity_time).toLocaleDateString('en-US', { month: 'short', year: 'numeric', day: 'numeric' })
                            : '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {c.course_slug && (
                              <a
                                href={`https://www.coursera.org/learn/${c.course_slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-500 hover:text-indigo-400 hover:underline whitespace-nowrap transition-colors"
                              >
                                View ↗
                              </a>
                            )}
                            {c.completed && c.certificate_url && (
                              <a
                                href={c.certificate_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline whitespace-nowrap transition-colors"
                              >
                                Certificate ↗
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
