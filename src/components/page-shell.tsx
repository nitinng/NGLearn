import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Standard full-width page container. Every page in the dashboard uses this so
 * widths and padding are consistent (no max-width caps).
 */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex w-full flex-1 flex-col gap-6 p-4 pb-20 md:p-6 lg:p-8', className)}>
      {children}
    </div>
  );
}

/**
 * Page title row: optional back link, icon, title, description on the left; actions on the right.
 * Wraps cleanly on small screens. Use shadcn <Button> (size="sm") for actions.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  back,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Extra row under the title (e.g. filters/pickers). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-5">
      {back && (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="flex shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
