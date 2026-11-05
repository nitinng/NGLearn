'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SnapshotMeta } from '@/lib/cohorts/data';
import { fmtDate, fmtHours, fmtNum } from './format';

export function SnapshotTable({ snapshots, canEdit }: { snapshots: SnapshotMeta[]; canEdit: boolean }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(s: SnapshotMeta) {
    if (!confirm(`Delete the ${s.snapshot_date} snapshot? Weekly numbers on either side of it will be recalculated against the neighbouring snapshots.`)) return;
    setDeleting(s.id);
    const res = await fetch(`/api/cohorts/snapshots/${s.id}`, { method: 'DELETE' });
    setDeleting(null);
    if (!res.ok) {
      toast.error((await res.json().catch(() => null))?.error ?? 'Delete failed');
      return;
    }
    toast.success('Snapshot deleted');
    router.refresh();
  }

  if (!snapshots.length) return <p className="text-sm text-muted-foreground">No snapshots uploaded yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Export date</th>
            <th className="px-3 py-2 text-right">Learners</th>
            <th className="px-3 py-2 text-right">Course rows</th>
            <th className="px-3 py-2 text-right">Total hours</th>
            <th className="px-3 py-2">File</th>
            <th className="px-3 py-2">Uploaded</th>
            {canEdit && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {snapshots.map(s => (
            <tr key={s.id}>
              <td className="whitespace-nowrap px-3 py-2 font-medium">{fmtDate(s.snapshot_date)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(s.learner_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(s.row_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(Number(s.total_hours))}</td>
              <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={s.filename ?? ''}>{s.filename ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {s.uploaded_by ?? '—'} · {fmtDate(s.uploaded_at)}
              </td>
              {canEdit && (
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" disabled={deleting === s.id} onClick={() => remove(s)} aria-label={`Delete ${s.snapshot_date} snapshot`}>
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
