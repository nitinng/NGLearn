'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LinkSelectItem {
  value: string;
  label: string;
  href: string;
}

/** shadcn Select whose options navigate to a URL (used for server-rendered filters). */
export function LinkSelect({
  items,
  value,
  placeholder,
  ariaLabel,
  className,
}: {
  items: LinkSelectItem[];
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={value}
      onValueChange={v => {
        const item = items.find(i => i.value === v);
        if (item) router.push(item.href);
      }}
    >
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map(i => (
          <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
