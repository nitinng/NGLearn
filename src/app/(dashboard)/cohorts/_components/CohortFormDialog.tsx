'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PROGRAMS } from '@/lib/cohorts/constants';
import { createCohort, updateCohort } from '../actions';

export interface CohortFormValue {
  id?: string;
  program: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  archived?: boolean;
}

export function CohortFormDialog({ initial, defaultProgram }: { initial?: CohortFormValue; defaultProgram: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<CohortFormValue>(
    initial ?? { program: defaultProgram, name: '', description: null, start_date: null, end_date: null },
  );
  const editing = !!initial?.id;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = editing ? await updateCohort(initial!.id!, v) : await createCohort(v);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? 'Cohort updated' : 'Cohort created');
      setOpen(false);
      if (!editing && res.data && 'id' in res.data) router.push(`/cohorts/${res.data.id}?tab=members`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm"><Pencil className="size-4" /> Edit</Button>
        ) : (
          <Button><Plus className="size-4" /> New cohort</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit cohort' : 'New cohort'}</DialogTitle>
            <DialogDescription>
              A cohort is a list of learner emails. Reports filter each weekly Coursera snapshot down to these people.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-program">Program</Label>
              <select
                id="c-program"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={v.program}
                onChange={e => setV({ ...v, program: e.target.value })}
              >
                {PROGRAMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" required placeholder="Cohort 3" value={v.name} onChange={e => setV({ ...v, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-start">Start date</Label>
              <Input id="c-start" type="date" value={v.start_date ?? ''} onChange={e => setV({ ...v, start_date: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end">End date</Label>
              <Input id="c-end" type="date" value={v.end_date ?? ''} onChange={e => setV({ ...v, end_date: e.target.value || null })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea id="c-desc" rows={2} value={v.description ?? ''} onChange={e => setV({ ...v, description: e.target.value })} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!v.archived} onChange={e => setV({ ...v, archived: e.target.checked })} />
              Archived (cohort has finished; hidden from the dashboard)
            </label>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save' : 'Create cohort'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
