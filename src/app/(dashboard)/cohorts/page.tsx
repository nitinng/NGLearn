import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, FileSpreadsheet, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCohortActor } from '@/lib/cohorts/guard';
import { isProgram, PROGRAMS } from '@/lib/cohorts/constants';
import { listCohorts, listSnapshots } from '@/lib/cohorts/data';
import { COHORT_EDIT_ROLES } from '@/lib/roles';
import { ProgramSwitcher } from './_components/ProgramSwitcher';
import { CohortFormDialog } from './_components/CohortFormDialog';
import { daysSince, fmtDate, fmtNum } from './_components/format';

export const dynamic = 'force-dynamic';

export default async function CohortsPage(props: { searchParams: Promise<{ program?: string }> }) {
  const actor = await getCohortActor('view');
  if (!actor) redirect('/');
  const sp = await props.searchParams;
  const program = isProgram(sp.program) ? sp.program : PROGRAMS[0];
  const canEdit = COHORT_EDIT_ROLES.includes(actor.role);

  const [cohorts, snapshots] = await Promise.all([listCohorts(program), listSnapshots(program)]);
  const latest = snapshots[0];
  const stale = latest ? (daysSince(latest.snapshot_date) ?? 0) > 8 : false;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cohort tracking</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly Coursera learning for each cohort, worked out from the full Coursera export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProgramSwitcher current={program} basePath="/cohorts" />
          <Button variant="outline" asChild>
            <Link href={`/cohorts/snapshots?program=${program}`}>
              <FileSpreadsheet className="size-4" /> {canEdit ? 'Upload snapshot' : 'Snapshots'}
            </Link>
          </Button>
          {canEdit && <CohortFormDialog defaultProgram={program} />}
        </div>
      </header>

      <section
        className={`flex flex-col gap-1 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${
          !latest || stale ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-2">
          {!latest || stale ? <AlertTriangle className="size-4 text-amber-600" /> : <CalendarDays className="size-4 text-muted-foreground" />}
          {latest ? (
            <span>
              Latest {program} snapshot: <strong>{fmtDate(latest.snapshot_date)}</strong> · {fmtNum(latest.learner_count)} learners ·{' '}
              {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} in total
              {stale && <> · <strong>more than a week old</strong></>}
            </span>
          ) : (
            <span>No {program} snapshots yet. Upload the full Coursera Learner Activity export to start tracking.</span>
          )}
        </div>
        {snapshots.length === 1 && (
          <span className="text-muted-foreground">Upload a second week to see hours learned between snapshots.</span>
        )}
      </section>

      {cohorts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No {program} cohorts yet.{canEdit && ' Create one, then add its member emails.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map(c => (
            <Link
              key={c.id}
              href={`/cohorts/${c.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{c.name}</h2>
                {c.archived ? <Badge variant="secondary">Archived</Badge> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
              </div>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="size-4" /> {fmtNum(c.member_count)} members</span>
                {(c.start_date || c.end_date) && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-4" /> {fmtDate(c.start_date)} – {fmtDate(c.end_date)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
