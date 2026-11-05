'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UploadResult {
  rows: number;
  learners: number;
  totalHours: number;
  carriedForward: number;
  skippedRows: number;
  duplicateRows: number;
  previousSnapshot: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Coursera export names look like "... CourseraEnterpriseExport 2026-07-16 17-18-01 UTC.xlsx". */
function dateFromFilename(name: string): string | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m && m[1] <= today() ? m[1] : null;
}

export function SnapshotUploader({ program, existingDates }: { program: string; existingDates: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(today());
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const exists = existingDates.includes(date);

  function pick(f: File | null) {
    setFile(f);
    setResult(null);
    if (f) {
      const d = dateFromFilename(f.name);
      if (d) setDate(d);
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('program', program);
      fd.set('snapshotDate', date);
      if (replace) fd.set('replace', 'true');
      const res = await fetch('/api/cohorts/snapshots', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      if (!res.ok) {
        toast.error(json.error ?? 'Upload failed');
        return;
      }
      setResult(json);
      setFile(null);
      setReplace(false);
      if (inputRef.current) inputRef.current.value = '';
      toast.success(`Snapshot for ${date} saved`);
      router.refresh();
    } catch {
      toast.error('Upload failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Upload {program} snapshot</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 hover:border-primary/50"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">
            {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : 'Choose or drop the Coursera export (.xlsx)'}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => pick(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="snap-date">Export date</Label>
          <Input id="snap-date" type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Button onClick={upload} disabled={!file || busy || (exists && !replace)}>
          <Upload className="size-4" /> {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {exists && (
        <label className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
          A snapshot for {date} already exists. Replace it.
        </label>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Use the date Coursera generated the export (it is usually in the file name). Upload the whole export: cohorts are filtered automatically.
      </p>
      {result && (
        <div className="mt-4 flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div>
            Saved {result.rows.toLocaleString()} course rows for {result.learners.toLocaleString()} learners
            ({Math.round(result.totalHours).toLocaleString()} total hours).
            {result.previousSnapshot && <> Compared with the {result.previousSnapshot} snapshot.</>}
            {result.carriedForward > 0 && <> {result.carriedForward} missing course rows carried forward.</>}
            {result.skippedRows > 0 && <> {result.skippedRows} rows without an email or course were skipped.</>}
            {result.duplicateRows > 0 && <> {result.duplicateRows} duplicate rows merged.</>}
          </div>
        </div>
      )}
    </section>
  );
}
