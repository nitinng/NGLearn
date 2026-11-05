import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCohortActor } from '@/lib/cohorts/guard';
import { isProgram, PROGRAMS } from '@/lib/cohorts/constants';
import { listActivity, listSnapshots } from '@/lib/cohorts/data';
import { COHORT_EDIT_ROLES } from '@/lib/roles';
import { ProgramSwitcher } from '../_components/ProgramSwitcher';
import { SnapshotUploader } from '../_components/SnapshotUploader';
import { SnapshotTable } from '../_components/SnapshotTable';
import { fmtDate } from '../_components/format';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  snapshot_upload: 'Uploaded snapshot',
  snapshot_delete: 'Deleted snapshot',
  cohort_create: 'Created cohort',
  cohort_update: 'Edited cohort',
  cohort_delete: 'Deleted cohort',
  members_upload: 'Updated members',
  member_remove: 'Removed member',
};

function describe(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const d = details as Record<string, string | number | null | undefined>;
  if (d.snapshot_date) return `${fmtDate(String(d.snapshot_date))}${d.rows ? ` · ${d.rows} rows` : ''}${d.learners ? ` · ${d.learners} learners` : ''}`;
  if (d.cohort) return `${d.cohort}: +${d.added ?? 0} added, ${d.removed ?? 0} removed`;
  if (d.name) return String(d.name);
  if (d.email) return String(d.email);
  return '';
}

export default async function SnapshotsPage(props: { searchParams: Promise<{ program?: string }> }) {
  const actor = await getCohortActor('view');
  if (!actor) redirect('/');
  const sp = await props.searchParams;
  const program = isProgram(sp.program) ? sp.program : PROGRAMS[0];
  const canEdit = COHORT_EDIT_ROLES.includes(actor.role);
  const [snapshots, activity] = await Promise.all([listSnapshots(program), listActivity(40)]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/cohorts?program=${program}`} className="text-sm text-muted-foreground hover:text-foreground">← Cohorts</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Weekly snapshots</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload the <strong>full</strong> Coursera &ldquo;Learner Activity&rdquo; export once a week. Coursera hours are cumulative, so
            each cohort&rsquo;s weekly hours are this week&rsquo;s total minus last week&rsquo;s, for that cohort&rsquo;s emails only.
          </p>
        </div>
        <ProgramSwitcher current={program} basePath="/cohorts/snapshots" />
      </header>

      {canEdit && <SnapshotUploader program={program} existingDates={snapshots.map(s => s.snapshot_date)} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{program} snapshots</h2>
        <SnapshotTable snapshots={snapshots} canEdit={canEdit} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent activity (all programs)</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.map(a => (
                  <tr key={a.id} className={a.status === 'error' ? 'bg-red-500/5' : undefined}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(a.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2">{a.performed_by ?? '—'}</td>
                    <td className="px-3 py-2">{a.program ? `${a.program}: ` : ''}{ACTION_LABEL[a.action] ?? a.action}{a.status === 'error' && ' (failed)'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.status === 'error' ? a.error_message : describe(a.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
