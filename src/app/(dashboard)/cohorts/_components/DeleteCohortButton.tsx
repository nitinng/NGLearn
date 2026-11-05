'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteCohort } from '../actions';

export function DeleteCohortButton({ id, name, program }: { id: string; name: string; program: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${name}" and its member list? Snapshot data is kept. To keep the cohort but hide it, use Edit → Archived instead.`)) return;
        start(async () => {
          const res = await deleteCohort(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success('Cohort deleted');
          router.push(`/cohorts?program=${program}`);
        });
      }}
    >
      <Trash2 className="size-4" /> Delete
    </Button>
  );
}
