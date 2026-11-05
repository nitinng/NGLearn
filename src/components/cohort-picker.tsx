import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { ALL_COHORTS, type CohortOption } from '@/lib/cohort-scope';

/** Row of cohort tabs. `hrefFor(id)` builds the link for a cohort id ('all' = every cohort). */
export function CohortPicker({
  cohorts,
  selected,
  hrefFor,
}: {
  cohorts: CohortOption[];
  selected: string | null;
  hrefFor: (cohort: string) => string;
}) {
  const total = cohorts.reduce((t, c) => t + c.member_count, 0);
  const tabs = [{ id: ALL_COHORTS, name: 'All cohorts', member_count: total }, ...cohorts];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <UsersRound className="h-3.5 w-3.5" /> Cohort
      </span>
      {tabs.map(c => {
        const active = (selected ?? ALL_COHORTS) === c.id;
        return (
          <Link
            key={c.id}
            href={hrefFor(c.id)}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {c.name} <span className="opacity-70">({c.member_count})</span>
          </Link>
        );
      })}
    </div>
  );
}
