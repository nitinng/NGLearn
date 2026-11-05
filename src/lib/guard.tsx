import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { hasAccess, RESOURCE_LABELS, type ActionType } from '@/lib/access';

type DenyOptions = {
  /** null hides the back link (e.g. on the home page itself) */
  backHref?: string | null;
  backLabel?: string;
  description?: string;
};

/**
 * Page guard for server components. Returns an "access denied" element when
 * the current user may not perform `action` on `resourceId`, else `null`.
 */
export async function denyUnlessAccess(
  resourceId: string,
  action: ActionType = 'view',
  options: DenyOptions = {},
): Promise<React.ReactElement | null> {
  if (await hasAccess(resourceId, action)) return null;
  const label = RESOURCE_LABELS[resourceId] ?? 'this page';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <div>
        <h2 className="text-xl font-bold">You don&rsquo;t have access to {label}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {options.description ?? 'Ask an admin to give you the Program role if you need it.'}
        </p>
      </div>
      {options.backHref !== null && (
        <Link href={options.backHref ?? '/'} className="text-sm font-medium underline">
          {options.backLabel ?? 'Back to dashboard'}
        </Link>
      )}
    </div>
  );
}
