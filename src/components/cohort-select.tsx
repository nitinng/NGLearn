'use client';

import { useRouter } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CohortSelectItem {
  value: string;
  label: string;
  href: string;
}

/** shadcn Select that navigates to the chosen cohort's URL. */
export function CohortSelect({ items, value }: { items: CohortSelectItem[]; value: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <UsersRound className="h-4 w-4" /> Cohort
      </span>
      <Select
        value={value}
        onValueChange={v => {
          const item = items.find(i => i.value === v);
          if (item) router.push(item.href);
        }}
      >
        <SelectTrigger className="min-w-52" aria-label="Cohort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(i => (
            <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
