'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCourseraSettings, type CourseraSettings } from './actions';

export function CourseraSettingsForm({ initial, canEdit }: { initial: CourseraSettings; canEdit: boolean }) {
  const [hours, setHours] = useState(String(initial.weeklyTargetHours));
  const [days, setDays] = useState(String(initial.inactiveAfterDays));
  const [pending, start] = useTransition();
  const dirty = Number(hours) !== initial.weeklyTargetHours || Number(days) !== initial.inactiveAfterDays;

  return (
    <form
      className="space-y-6 rounded-xl border border-border/80 bg-card/60 p-6"
      onSubmit={e => {
        e.preventDefault();
        start(async () => {
          const res = await saveCourseraSettings({ weeklyTargetHours: Number(hours), inactiveAfterDays: Number(days) });
          if (!res.ok) toast.error(res.error);
          else toast.success(`Saved. ${res.reflagged.toLocaleString()} learner-weeks re-checked against the new target.`);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="weekly-target">Weekly learning-hours target</Label>
        <div className="flex items-center gap-2">
          <Input id="weekly-target" type="number" min={0.5} max={100} step={0.5} value={hours} disabled={!canEdit}
            onChange={e => setHours(e.target.value)} className="w-32" />
          <span className="text-sm text-muted-foreground">hours per Monday–Sunday week</span>
        </div>
        <p className="text-xs text-muted-foreground">
          A learner is <strong>on target</strong> for a week when they log at least this many hours that week. Learners
          who learned something but less than this show as <strong>below target</strong>. Default: 5 hours. For an upload
          that covers several weeks (skipped weeks), the target is multiplied by the number of weeks. Changing it
          updates every period already imported.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inactive-days">Inactive after</Label>
        <div className="flex items-center gap-2">
          <Input id="inactive-days" type="number" min={7} max={365} step={1} value={days} disabled={!canEdit}
            onChange={e => setDays(e.target.value)} className="w-32" />
          <span className="text-sm text-muted-foreground">days without Coursera activity</span>
        </div>
        <p className="text-xs text-muted-foreground">Shown in the dashboard alerts. Default: 90 days.</p>
      </div>

      {canEdit ? (
        <Button type="submit" disabled={pending || !dirty}>{pending ? 'Saving…' : 'Save'}</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Only Admin, PNC and Program roles can change these.</p>
      )}
    </form>
  );
}
