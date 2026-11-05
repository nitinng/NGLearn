import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { DashboardGreeting } from '@/components/dashboard-greeting';
import { getCohortActor } from '@/lib/cohorts/guard';
import { listCohorts, listSnapshots, safeLoad } from '@/lib/cohorts/data';
import { LoadError } from './cohorts/_components/LoadError';
import { PROGRAMS } from '@/lib/cohorts/constants';
import { fmtDate, fmtNum } from './cohorts/_components/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const actor = await getCohortActor('view');

  if (!actor) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <DashboardGreeting />
        <p className="text-sm text-muted-foreground">
          You don&rsquo;t have access to cohort tracking yet. Ask an admin to give you the Program role.
        </p>
      </div>
    );
  }

  const loaded = await safeLoad(() =>
    Promise.all(
      PROGRAMS.map(async p => {
        const [cohorts, snapshots] = await Promise.all([listCohorts(p), listSnapshots(p)]);
        return { program: p, cohorts: cohorts.filter(c => !c.archived), latest: snapshots[0] ?? null };
      }),
    ),
  );
  if (loaded.error !== null) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:p-8">
        <DashboardGreeting />
        <LoadError message={loaded.error} />
      </div>
    );
  }
  const programs = loaded.data;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 pb-20 md:p-6 lg:p-8">
      <DashboardGreeting />
      {programs.map(({ program, cohorts, latest }) => (
        <section key={program} className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{program}</h2>
            <Link href={`/cohorts?program=${program}`} className="text-sm text-muted-foreground hover:text-foreground">
              {latest ? `Latest snapshot ${fmtDate(latest.snapshot_date)}` : 'No snapshots yet'} →
            </Link>
          </div>
          {cohorts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No active cohorts.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cohorts.map(c => (
                <Link key={c.id} href={`/cohorts/${c.id}`} className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/40">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground"><Users className="size-4" /> {fmtNum(c.member_count)} members</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
