import { ALL_COHORTS, type CohortOption } from '@/lib/cohort-scope';
import { CohortSelect } from '@/components/cohort-select';

/** Cohort chooser (shadcn Select). `hrefFor(id)` builds the link for a cohort id ('all' = every cohort). */
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
  const items = [{ id: ALL_COHORTS, name: 'All cohorts', member_count: total }, ...cohorts].map(c => ({
    value: c.id,
    label: `${c.name} (${c.member_count})`,
    href: hrefFor(c.id),
  }));
  return <CohortSelect items={items} value={selected ?? ALL_COHORTS} />;
}
