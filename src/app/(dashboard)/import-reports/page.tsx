'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IMPORT_BUCKET } from '@/lib/coursera-storage';
import { PageShell, PageHeader } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { addDays, completedSundaysSince, makePeriodLabeler, uploadableSundays } from '@/lib/report-periods';

/** Zuvy's agreed baseline: lifetime learning up to Sunday 29 March 2026 (Week 1 = 30 Mar – 5 Apr). */
const DEFAULT_BASELINE = '2026-03-29';
/** Start date to use in Coursera's "Learner activity date range" for every export (MM/DD/YYYY). */
const COURSERA_START_DATE = '04/01/2020';
/** YYYY-MM-DD → MM/DD/YYYY, as Coursera's date fields expect. */
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
/** How far back the baseline list goes. */
const BASELINE_LIST_FROM = '2025-11-02';
import { Upload, FileSpreadsheet, Download, RotateCcw, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Info } from 'lucide-react';

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
  // Every finished week after the latest upload (oldest first). Default = the next upload (the week right after the last one).
  const choices = uploadableSundays(importedDates);
  const labelFor = (d: string) => makePeriodLabeler([...importedDates, d])(d);
  const selectedMonth = isBaseline
    ? baselineSunday
    : weekChoice && choices.includes(weekChoice) ? weekChoice : choices[0] ?? '';
  const nextReady = !!selectedMonth;
  const selectedPeriod = selectedMonth ? labelFor(selectedMonth) : null;
  const historyLabel = makePeriodLabeler(importedDates);
  const periodLabel = (d: string) => historyLabel(d).label;
  const latestImported = importedDates[importedDates.length - 1] ?? null;

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
  const handleUpload = async () => {
    if (!file || !selectedMonth || !nextReady) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

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

    try {
      const res = await fetch('/api/coursera/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
      } else {
        setUploadResult(json);
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
  const visibleLog = activeTab === 'all' ? importLog : importLog.filter(r => r.action === activeTab);

  return (
    <PageShell>
      <PageHeader
        icon={Upload}
        title="Import Coursera Reports"
        description="Upload the full Coursera Learner Activity export for each Monday–Sunday week. Everything is stored, but the dashboard, logs and reports only show learners who are in a cohort. Add someone to a cohort later and their past weeks appear too."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/templates/coursera_weekly_report_template.xlsx" download>
              <Download className="w-4 h-4" />
              Download Template
            </a>
          </Button>
        }
      />

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Period being imported */}
          {isBaseline ? (
            <div className="space-y-1.5">
              <Label htmlFor="baseline-sunday">Baseline report (one-off): lifetime learning up to Sunday…</Label>
              <Select value={baselineSunday} onValueChange={setBaselineSunday}>
                <SelectTrigger id="baseline-sunday" className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {baselineOptions.map(d => (
                    <SelectItem key={d} value={d}>{longDate(d)}{d === DEFAULT_BASELINE ? ' (agreed baseline)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Upload the Coursera export that covers everything up to this Sunday. Week 1 will then be Monday {longDate(addDays(baselineSunday, 1))} to Sunday {longDate(addDays(baselineSunday, 7))}.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="week-choice">Week (report end date)</Label>
              {choices.length > 0 ? (
                <>
                  <Select value={selectedMonth} onValueChange={setWeekChoice}>
                    <SelectTrigger id="week-choice" className="w-full max-w-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.map(d => (
                        <SelectItem key={d} value={d}>{labelFor(d).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Report start date is always <strong className="text-foreground">1 April 2020</strong>; the end date is the Sunday shown.
                    {selectedPeriod && selectedPeriod.weeks > 1 && (
                      <> Weeks since your last upload ({selectedPeriod.weeks} weeks) will be counted together in this report, and the weekly target is multiplied by {selectedPeriod.weeks}.</>
                    )}
                  </p>
                </>
              ) : (
                <div className="p-4 rounded-lg border border-border/60 bg-muted/30 text-sm">
                  Nothing to import yet. The next week, {labelFor(addDays(latestImported!, 7)).label}, can be imported from Monday {longDate(addDays(latestImported!, 8))}.
                </div>
              )}
            </div>
          )}

          {/* What to export from Coursera */}
          {selectedMonth && (
            <div className="flex gap-3 p-4 rounded-lg border border-sky-500/30 bg-sky-500/5 text-sm">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Date range to pick in Coursera</p>
                <p className="text-muted-foreground">
                  In the Coursera export, set <strong className="text-foreground">Learner activity date range → Custom</strong>:
                </p>
                <p className="font-mono text-foreground">
                  Start date {COURSERA_START_DATE} · End date {usDate(selectedMonth)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Always use the same start date so every learner is included. The end date is the Sunday
                  {isBaseline ? ' this baseline runs up to.' : ' this week ends on (do not include Monday).'} Then upload the file here as it is.
                </p>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200',
              dragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40 hover:bg-accent/40',
            )}
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
              {uploadResult.extraSheets && (
                <p className="text-xs text-muted-foreground mt-1">
                  Also saved for the beta report: {uploadResult.extraSheets.specializations.toLocaleString()} specialization rows,{' '}
                  {uploadResult.extraSheets.programMembers.toLocaleString()} program members, {uploadResult.extraSheets.videoClips.toLocaleString()} video clip rows.
                </p>
              )}
            </div>
          )}

          {/* Upload button */}
          <Button
            id="upload-submit-btn"
            className="w-full"
            onClick={() => handleUpload()}
            disabled={!file || !selectedMonth || !nextReady || uploading}
          >
            {uploading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><Upload className="w-4 h-4" /> {isBaseline ? 'Upload baseline report' : selectedPeriod ? `Upload ${selectedPeriod.shortLabel}` : 'Upload'}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="px-6 py-4 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Import History</h2>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              {(['import', 'rollback', 'recalculate', 'all'] as const).map(tab => (
                <TabsTrigger key={tab} value={tab} className="text-xs capitalize">
                  {tab === 'all' ? 'All' : `${tab}s`}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {loadingHistory ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : importLog.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No imports yet. Upload your first Coursera report above.</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4">Snapshot</TableHead>
                <TableHead className="px-4">File</TableHead>
                <TableHead className="px-4 text-right">Rows</TableHead>
                <TableHead className="px-4 text-right">Learners</TableHead>
                <TableHead className="px-4">Action</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Duration</TableHead>
                <TableHead className="px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLog.map((row, idx) => {
                const isRolledBack = rolledBackMonths.has(row.snapshot_month);
                const isNewestActive = row.action === 'import' && row.status === 'success' && !isRolledBack && row.snapshot_month === newestImportMonth;
                const isBaselineRow = row.snapshot_month === baselineDate;
                const canRollback = isNewestActive && !isBaselineRow;
                const olderThanNewest = row.action === 'import' && row.status === 'success' && !isRolledBack && !isNewestActive;

                let tooltipMsg = undefined;
                if (isRolledBack && row.action === 'import') tooltipMsg = 'Already rolled back';
                else if (olderThanNewest) tooltipMsg = `Roll back ${periodLabel(newestImportMonth!)} first`;

                return (
                  <TableRow key={`${row.id}-${idx}`}>
                    <TableCell className="px-4 py-3 font-medium">{periodLabel(row.snapshot_month)}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{row.filename ?? '—'}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">{formatRows(row.rows_imported)}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">{formatRows(row.learners_affected)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent capitalize',
                          row.action === 'import' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          row.action === 'rollback' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {row.action === 'import' && <Upload className="w-3 h-3" />}
                        {row.action === 'rollback' && <RotateCcw className="w-3 h-3" />}
                        {row.action === 'recalculate' && <RefreshCw className="w-3 h-3" />}
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
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
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatDuration(row.duration_ms)}</TableCell>
                    <TableCell className="px-4 py-3">
                      {row.action === 'import' && row.status === 'success' && (
                        <div className="flex items-center gap-2">
                          {/* Recalculate — always available for successful imports */}
                          <Button
                            id={`recalc-btn-${row.snapshot_month}`}
                            variant="outline"
                            size="xs"
                            onClick={() => handleRecalculate(row)}
                            disabled={recalcLoading === row.snapshot_month}
                            title="Recompute metrics without re-uploading"
                          >
                            <RefreshCw className={cn('w-3 h-3', recalcLoading === row.snapshot_month && 'animate-spin')} />
                            Recalculate
                          </Button>
                          {/* Rollback: only the newest import, never the baseline */}
                          {!isBaselineRow && (
                            <Button
                              id={`rollback-btn-${row.snapshot_month}`}
                              variant="outline"
                              size="xs"
                              onClick={() => canRollback && setConfirmRollback(row)}
                              disabled={!canRollback}
                              title={tooltipMsg}
                              className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Rollback confirmation */}
      <Dialog open={!!confirmRollback} onOpenChange={open => { if (!open && !rollbackLoading) setConfirmRollback(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </span>
              Confirm Rollback
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              This will permanently delete all data for{' '}
              <strong className="text-foreground">{confirmRollback ? periodLabel(confirmRollback.snapshot_month) : ''}</strong>.
              Weeks must be rolled back newest first.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRollback(null)} disabled={rollbackLoading}>
              Cancel
            </Button>
            <Button id="confirm-rollback-btn" variant="destructive" onClick={handleRollback} disabled={rollbackLoading}>
              {rollbackLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Rolling back…</> : 'Yes, Delete Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
