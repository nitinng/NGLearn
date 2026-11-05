'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CohortMember } from '@/lib/cohorts/data';
import { removeCohortMember } from '../actions';
import { fmtDate } from './format';

interface UploadResult {
  added: number;
  updated: number;
  removed: number;
  duplicates: number;
  invalid: string[];
  invalidCount: number;
}

export function MembersPanel({ cohortId, members, canEdit }: { cohortId: string; members: CohortMember[]; canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'add' | 'replace'>(members.length ? 'add' : 'replace');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [query, setQuery] = useState('');
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? members.filter(m => m.email.includes(q) || (m.alt_email ?? '').includes(q) || (m.name ?? '').toLowerCase().includes(q))
      : members;
  }, [members, query]);

  async function submit() {
    if (mode === 'replace' && members.length && !confirm('Replace the member list? Anyone not in the new list will be removed from this cohort.')) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.set('file', file);
      else fd.set('text', text);
      fd.set('mode', mode);
      const res = await fetch(`/api/cohorts/${cohortId}/members`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({ error: `Failed (${res.status})` }));
      if (!res.ok) {
        toast.error(json.error ?? 'Upload failed');
        return;
      }
      setResult(json);
      setFile(null);
      setText('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success(`${json.added} added, ${json.updated} updated${json.removed ? `, ${json.removed} removed` : ''}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function remove(m: CohortMember) {
    if (!confirm(`Remove ${m.email} from this cohort?`)) return;
    start(async () => {
      const res = await removeCohortMember(cohortId, m.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success('Member removed');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Add members</h2>
              <p className="text-sm text-muted-foreground">
                Paste emails (one per line: <code>email, alt email, name</code>) or upload an .xlsx/.csv with an Email column.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/cohorts/members-template"><Download className="size-4" /> Template</a>
            </Button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Textarea
              rows={6}
              placeholder={'learner1@navgurukul.org\nlearner2@navgurukul.org, learner2@gmail.com, Learner Two'}
              value={text}
              disabled={!!file}
              onChange={e => setText(e.target.value)}
            />
            <div className="flex flex-col gap-3">
              <div
                className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground hover:border-primary/50"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  setFile(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                {file ? file.name : 'or choose / drop an .xlsx or .csv file'}
                <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="mode" checked={mode === 'add'} onChange={() => setMode('add')} /> Add to list
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace list
                </label>
                <Button className="ml-auto" onClick={submit} disabled={busy || (!file && !text.trim())}>
                  <Upload className="size-4" /> {busy ? 'Saving…' : 'Save members'}
                </Button>
              </div>
              {file && (
                <button className="self-start text-xs text-muted-foreground underline" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  Clear file
                </button>
              )}
            </div>
          </div>
          {result && (result.invalidCount > 0 || result.duplicates > 0) && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              {result.duplicates > 0 && <p>{result.duplicates} duplicate emails were merged.</p>}
              {result.invalidCount > 0 && (
                <>
                  <p>{result.invalidCount} lines had no valid email and were skipped:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {result.invalid.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{members.length} members</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="w-64 pl-8" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Alt email</th>
                <th className="px-3 py-2">Added</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(m => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{m.name ?? '—'}</td>
                  <td className="px-3 py-2">{m.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.alt_email ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(m.added_at)}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(m)} aria-label={`Remove ${m.email}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No members{query ? ' match' : ' yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
