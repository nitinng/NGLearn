import Link from 'next/link';
import { PROGRAMS } from '@/lib/cohorts/constants';
import { cn } from '@/lib/utils';

export function ProgramSwitcher({ current, basePath }: { current: string; basePath: string }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" role="tablist" aria-label="Program">
      {PROGRAMS.map(p => (
        <Link
          key={p}
          href={`${basePath}?program=${p}`}
          role="tab"
          aria-selected={p === current}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            p === current ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}
