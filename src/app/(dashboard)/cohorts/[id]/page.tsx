import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCohortActor } from '@/lib/cohorts/guard';
import { buildCohortReport, safeLoad } from '@/lib/cohorts/data';
import { LoadError } from '../_components/LoadError';
import { COHORT_EDIT_ROLES } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { CohortFormDialog } from '../_components/CohortFormDialog';
import { CohortReportView } from '../_components/CohortReportView';
import { MembersPanel } from '../_components/MembersPanel';
import { DeleteCohortButton } from '../_components/DeleteCohortButton';
import { fmtDate, fmtNum } from '../_components/format';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CohortPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string; tab?: string }>;
}) {
  const actor = await getCohortActor('view');
  if (!actor) redirect('/');
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;
  const tab = sp.tab === 'members' ? 'members' : 'report';
  const canEdit = COHORT_EDIT_ROLES.includes(actor.role);

  const loaded = await safeLoad(() => buildCohortReport(id, { startId: sp.start, endId: sp.end, withTrend: tab === 'report' }));
  if (loaded.error !== null) return <LoadError message={loaded.error} />;
  const bundle = loaded.data;
  if (!bundle) notFound();
  const { cohort, members } = bundle;

  const tabHref = (t: string) => {
    const q = new URLSearchParams();
    if (sp.start) q.set('start', sp.start);
    if (sp.end) q.set('end', sp.end);
    if (t !== 'report') q.set('tab', t);
    const s = q.toString();
    return `/cohorts/${id}${s ? `?${s}` : ''}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/cohorts?program=${cohort.program}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← {cohort.program} cohorts
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {cohort.name}
            {cohort.archived && <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">(archived)</span>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort.program} · {fmtNum(members.length)} members
            {(cohort.start_date || cohort.end_date) && <> · {fmtDate(cohort.start_date)} – {fmtDate(cohort.end_date)}</>}
          </p>
          {cohort.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{cohort.description}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <CohortFormDialog defaultProgram={cohort.program} initial={cohort} />
            <DeleteCohortButton id={cohort.id} name={cohort.name} program={cohort.program} />
          </div>
        )}
      </header>

      <nav className="flex gap-1 border-b border-border" aria-label="Cohort sections">
        {[
          ['report', 'Report'],
          ['members', `Members (${members.length})`],
        ].map(([t, label]) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'members' ? (
        <MembersPanel cohortId={cohort.id} members={members} canEdit={canEdit} />
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          This cohort has no members yet. <Link className="underline" href={tabHref('members')}>Add member emails</Link> to see the report.
        </div>
      ) : !bundle.report || !bundle.end ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No {cohort.program} snapshots uploaded yet.{' '}
          <Link className="underline" href={`/cohorts/snapshots?program=${cohort.program}`}>Upload the Coursera export</Link>.
        </div>
      ) : (
        <CohortReportView
          cohortId={cohort.id}
          snapshots={bundle.snapshots.map(s => ({ id: s.id, date: s.snapshot_date }))}
          startId={bundle.start?.id ?? null}
          endId={bundle.end.id}
          report={bundle.report}
          trend={bundle.trend}
        />
      )}
    </div>
  );
}
