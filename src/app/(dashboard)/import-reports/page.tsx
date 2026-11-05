'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IMPORT_BUCKET } from '@/lib/coursera-storage';
import { addDays, completedSundaysSince, makePeriodLabeler, uploadableSundays } from '@/lib/report-periods';

/** Zuvy's agreed baseline: lifetime learning up to Sunday 29 March 2026 (Week 1 = 30 Mar – 5 Apr). */
const DEFAULT_BASELINE = '2026-03-29';
/** How far back the baseline list goes. */
const BASELINE_LIST_FROM = '2025-11-02';
import { Upload, FileSpreadsheet, Download, RotateCcw, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface AvailableMonth { month: string; generated_at: string }
interface ImportLogRow {
  id: number;
  snapshot_month: string;
  filename: string | null;
  rows_imported: number | null;
  learners_affected: number | null;
  action: string;
  status: string;
  duration_ms: number | null;
  imported_by: string | null;
  imported_at: string;
}
interface UploadResult {
  success: boolean;
  rowsImported: number;
  learnersAffected: number;
  skippedRows: number;
  durationMs: number;
  month: string;
  period?: string;
  extraSheets?: { specializations: number; programMembers: number; videoClips: number };
  notices?: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function formatRows(n: number | null) {
  if (!n) return '—';
  return n.toLocaleString();
}

const longDate = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportCourseraPage() {
  const supabase = createClient();

  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [importLog, setImportLog] = useState<ImportLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'import' | 'rollback' | 'recalculate'>('import');

  const baselineOptions = completedSundaysSince(BASELINE_LIST_FROM);
  const [baselineSunday, setBaselineSunday] = useState(() =>
    baselineOptions.includes(DEFAULT_BASELINE) ? DEFAULT_BASELINE : baselineOptions[0]);
  const [weekChoice, setWeekChoice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [confirmRollback, setConfirmRollback] = useState<ImportLogRow | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/coursera/import/history');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(json.error ?? 'Could not load import history.');
        return;
      }
      setAvailableMonths(json.months ?? []);
      setImportLog(json.log ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fixed weekly schedule ──────────────────────────────────────────────────
  const importedDates = availableMonths.map(m => m.month).sort();
  const baselineDate = importedDates[0] ?? null;
  const isBaseline = importedDates.length === 0;
  // Every finished week after the latest upload (oldest first). Default = the newest.
  const choices = uploadableSundays(importedDates);
  const labelFor = (d: string) => makePeriodLabeler([...importedDates, d])(d);
  const selectedMonth = isBaseline
    ? baselineSunday
    : weekChoice && choices.includes(weekChoice) ? weekChoice : choices[choices.length - 1] ?? '';
  const nextReady = !!selectedMonth;
  const selectedPeriod = selectedMonth ? labelFor(selectedMonth) : null;
  const historyLabel = makePeriodLabeler(importedDates);
  const periodLabel = (d: string) => historyLabel(d).label;
  const latestImported = importedDates[importedDates.length - 1] ?? null;
  void baselineDate;

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Only .xlsx files are supported.');
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setUploadError('File size must be less than 25MB.');
      return;
    }
    setFile(f);
    setUploadError(null);
    setWarnings(null);
    setUploadResult(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (acknowledge = false) => {
    if (!file || !selectedMonth || !nextReady) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    if (!acknowledge) setWarnings(null);

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Upload straight to private Storage (exports are often >4.5 MB, too big for an API request).
    const urlRes = await fetch('/api/coursera/import/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
    });
    const urlJson = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) {
      setUploadError(urlJson.error ?? 'Could not start the upload.');
      setUploading(false);
      return;
    }
    const { error: storageErr } = await supabase.storage
      .from(IMPORT_BUCKET)
      .uploadToSignedUrl(urlJson.path, urlJson.token, file, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    if (storageErr) {
      setUploadError(`Upload failed: ${storageErr.message}`);
      setUploading(false);
      return;
    }

    // 2. Process it.
    const fd = new FormData();
    fd.append('storagePath', urlJson.path);
    fd.append('fileName', file.name);
    fd.append('fileSize', String(file.size));
    fd.append('snapshotMonth', selectedMonth);
    if (user?.email) fd.append('uploadedBy', user.email);
    if (acknowledge) fd.append('acknowledgeWarnings', 'true');

    try {
      const res = await fetch('/api/coursera/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.status === 422 && json.code === 'period_warnings') {
        setWarnings(json.warnings ?? []);
      } else if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
      } else {
        setUploadResult(json);
        setWarnings(null);
        setFile(null);
        await fetchData();
      }
    } catch {
      setUploadError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Rollback ───────────────────────────────────────────────────────────────
  // Find the most-recently-imported month (the only one that can be rolled back)
  const monthStatus = new Map<string, string>();
  for (const r of importLog) {
    if (r.status === 'success' && !monthStatus.has(r.snapshot_month)) {
      monthStatus.set(r.snapshot_month, r.action);
    }
  }

  const rolledBackMonths = new Set(
    Array.from(monthStatus.entries())
      .filter(([_, action]) => action === 'rollback')
      .map(([month]) => month)
  );
  const activeImports = importLog.filter(
    r => r.action === 'import' && r.status === 'success' && !rolledBackMonths.has(r.snapshot_month)
  );
  const newestImportMonth = activeImports[0]?.snapshot_month ?? null;

  const handleRollback = async () => {
    if (!confirmRollback) return;
    setRollbackLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const res = await fetch('/api/coursera/rollback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotMonth: confirmRollback.snapshot_month, requestedBy: user?.email }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? 'Rollback failed');
      } else {
        await fetchData();
      }
    } catch {
      alert('Network error during rollback.');
    } finally {
      setRollbackLoading(false);
      setConfirmRollback(null);
    }
  };

  // ── Recalculate ────────────────────────────────────────────────────────────
  const handleRecalculate = async (row: ImportLogRow) => {
    setRecalcLoading(row.snapshot_month);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const res = await fetch('/api/coursera/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotMonth: row.snapshot_month, requestedBy: user?.email }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.error ?? 'Recalculate failed');
      else await fetchData();
    } catch {
      alert('Network error during recalculate.');
    } finally {
      setRecalcLoading(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 text-blue-500 rounded-xl border border-blue-500/20 shadow-inner">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import Coursera Reports</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Upload the full Coursera Learner Activity export for each Monday–Sunday week. Everything is stored, but the dashboard, logs and reports only show learners who are in a cohort. Add someone to a cohort later and their past weeks appear too.</p>
          </div>
        </div>
        <a
          href="/templates/coursera_weekly_report_template.xlsx"
          download
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border/80 hover:bg-accent transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Template
        </a>
      </div>

      {/* Upload Section */}
      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm p-6 space-y-5">
        <h2 className="text-lg font-semibold">Upload Report</h2>

        {/* Reporting rules */}
        <div className="flex gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">Weekly reporting rules: no overlapping days</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">First import only:</strong> a baseline report with all learning up to a <strong className="text-foreground">Sunday</strong> (Coursera lifetime report).</li>
              <li><strong className="text-foreground">Then every Monday:</strong> generate the Coursera report <strong className="text-foreground">up to the previous Sunday</strong>. Do <strong className="text-foreground">not</strong> include Monday. Monday belongs to the next week; including it moves those hours into the wrong week.</li>
              <li>Weeks run <strong className="text-foreground">Monday → Sunday</strong> and only move forward. The list offers every finished week after your last upload. If you skip weeks, the skipped weeks are merged into this upload (e.g. &ldquo;Weeks 2–5&rdquo;); nothing is ever counted twice.</li>
              <li>Times are India time (IST). A little activity after Sunday (export downloaded Mon–Wed) is just noted. If the file has activity weeks after the chosen Sunday, it&apos;s a newer export and the import stops and suggests the right week.</li>
            </ul>
          </div>
        </div>

        {/* Period being imported */}
        {isBaseline ? (
          <div className="space-y-1.5">
            <label htmlFor="baseline-sunday" className="text-sm font-medium text-foreground/80">
              Baseline report (one-off): lifetime learning up to Sunday…
            </label>
            <select
              id="baseline-sunday"
              value={baselineSunday}
              onChange={e => setBaselineSunday(e.target.value)}
              className="w-full max-w-sm bg-background border border-border/80 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            >
              {baselineOptions.map(d => (
                <option key={d} value={d}>{longDate(d)}{d === DEFAULT_BASELINE ? ' (agreed baseline)' : ''}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Upload the Coursera export that covers everything up to this Sunday. Week 1 will then be Monday {longDate(addDays(baselineSunday, 1))} to Sunday {longDate(addDays(baselineSunday, 7))}.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="week-choice" className="text-sm font-medium text-foreground/80">Week this report covers</label>
            {choices.length > 0 ? (
              <>
                <select
                  id="week-choice"
                  value={selectedMonth}
                  onChange={e => { setWeekChoice(e.target.value); setWarnings(null); }}
                  className="w-full max-w-xl bg-background border border-border/80 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                >
                  {choices.map(d => (
                    <option key={d} value={d}>{labelFor(d).label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {selectedPeriod && selectedPeriod.weeks > 1 ? (
                    <>This skips weeks: everything learned from Monday {longDate(selectedPeriod.start!)} to Sunday {longDate(selectedPeriod.end)} is counted as one period ({selectedPeriod.weeks} weeks), and the weekly target is multiplied by {selectedPeriod.weeks}. </>
                  ) : selectedPeriod ? (
                    <>In Coursera, generate the report on Monday {longDate(addDays(selectedPeriod.end, 1))}, covering up to Sunday {longDate(selectedPeriod.end)}. </>
                  ) : null}
                  The list shows every finished week after your last upload; pick the Sunday your export runs up to.
                </p>
              </>
            ) : (
              <div className="p-4 rounded-lg border border-border/60 bg-muted/30 text-sm">
                Nothing to import yet. The next week, {labelFor(addDays(latestImported!, 7)).label}, can be imported from Monday {longDate(addDays(latestImported!, 8))}.
              </div>
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${dragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40 hover:bg-accent/40'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          {file ? (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-foreground">Drop your .xlsx file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Supports exports up to 25MB and 100,000 rows</p>
            </div>
          )}
        </div>

        {/* Error / result */}
        {uploadError && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}
        {uploadResult && (
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" /> Imported {uploadResult.period ?? 'report'}</div>
            <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
              <div><span className="text-muted-foreground">Rows imported</span><br /><strong>{uploadResult.rowsImported.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Learners</span><br /><strong>{uploadResult.learnersAffected.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Duration</span><br /><strong>{formatDuration(uploadResult.durationMs)}</strong></div>
            </div>
            {uploadResult.notices && uploadResult.notices.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-700 dark:text-amber-400">
                {uploadResult.notices.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
            {uploadResult.extraSheets && (
              <p className="text-xs text-muted-foreground mt-1">
                Also saved for the beta report: {uploadResult.extraSheets.specializations.toLocaleString()} specialization rows,{' '}
                {uploadResult.extraSheets.programMembers.toLocaleString()} program members, {uploadResult.extraSheets.videoClips.toLocaleString()} video clip rows.
              </p>
            )}
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/5 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" /> This report may overlap with another week
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">Best fix: regenerate the report in Coursera ending on Sunday and upload that instead.</p>
            <button
              type="button"
              onClick={() => {
                if (confirm('Import anyway? Hours from days outside this week will be counted in this week.')) handleUpload(true);
              }}
              disabled={uploading}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-40"
            >
              I&apos;ve checked. Import anyway.
            </button>
          </div>
        )}

        {/* Upload button */}
        <button
          id="upload-submit-btn"
          onClick={() => handleUpload(false)}
          disabled={!file || !selectedMonth || !nextReady || uploading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {uploading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><Upload className="w-4 h-4" /> {isBaseline ? 'Upload baseline report' : selectedPeriod ? `Upload ${selectedPeriod.shortLabel}` : 'Upload'}</>
          )}
        </button>
      </div>

      {/* Import History */}
      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import History</h2>
          <div className="flex bg-muted/50 p-1 rounded-lg">
            {(['import', 'rollback', 'recalculate', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'all' ? 'All' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>
        {loadingHistory ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : importLog.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No imports yet. Upload your first Coursera report above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Snapshot</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">File</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rows</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Learners</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'all' ? importLog : importLog.filter(r => r.action === activeTab)).map((row, idx) => {
                  const isRolledBack = rolledBackMonths.has(row.snapshot_month);
                  const isNewestActive = row.action === 'import' && row.status === 'success' && !isRolledBack && row.snapshot_month === newestImportMonth;
                  const canRollback = isNewestActive;
                  const olderThanNewest = row.action === 'import' && row.status === 'success' && !isRolledBack && !isNewestActive;
                  
                  let tooltipMsg = undefined;
                  if (isRolledBack && row.action === 'import') tooltipMsg = 'Already rolled back';
                  else if (olderThanNewest) tooltipMsg = `Roll back ${periodLabel(newestImportMonth!)} first`;

                  return (
                    <tr key={`${row.id}-${idx}`} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{periodLabel(row.snapshot_month)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{row.filename ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRows(row.rows_imported)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRows(row.learners_affected)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                          ${row.action === 'import' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            row.action === 'rollback' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                          {row.action === 'import' && <Upload className="w-3 h-3" />}
                          {row.action === 'rollback' && <RotateCcw className="w-3 h-3" />}
                          {row.action === 'recalculate' && <RefreshCw className="w-3 h-3" />}
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> success
                          </span>
                        ) : row.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive">
                            <XCircle className="w-3 h-3" /> error
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" /> {row.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatDuration(row.duration_ms)}</td>
                      <td className="px-4 py-3">
                        {row.action === 'import' && row.status === 'success' && (
                          <div className="flex items-center gap-2">
                            {/* Recalculate — always available for successful imports */}
                            <button
                              id={`recalc-btn-${row.snapshot_month}`}
                              onClick={() => handleRecalculate(row)}
                              disabled={recalcLoading === row.snapshot_month}
                              title="Recompute metrics without re-uploading"
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border/80 hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-3 h-3 ${recalcLoading === row.snapshot_month ? 'animate-spin' : ''}`} />
                              Recalculate
                            </button>
                            {/* Rollback — only the newest import */}
                            <button
                              id={`rollback-btn-${row.snapshot_month}`}
                              onClick={() => canRollback && setConfirmRollback(row)}
                              disabled={!canRollback}
                              title={tooltipMsg}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rollback confirmation modal */}
      {confirmRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">Confirm Rollback</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will permanently delete all data for{' '}
              <strong className="text-foreground">{periodLabel(confirmRollback.snapshot_month)}</strong>.
              Weeks must be rolled back newest first.
            </p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmRollback(null)}
                className="flex-1 py-2 rounded-lg border border-border/80 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-rollback-btn"
                onClick={handleRollback}
                disabled={rollbackLoading}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {rollbackLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Rolling back…</> : 'Yes, Delete Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
