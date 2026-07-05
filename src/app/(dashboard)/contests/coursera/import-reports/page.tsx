'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, FileSpreadsheet, Download, RotateCcw, RefreshCw, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { getSubContests } from '@/app/actions/contests';

// ── Types ────────────────────────────────────────────────────────────────────
interface SubContest {
  id: string;
  name: string;
}

interface ImportLogRow {
  id: number;
  sub_contest_id: string;
  sub_contest_name?: string; // We'll join this
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
  subContestId: string;
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportCourseraPage() {
  const supabase = createClient();

  const [availableContests, setAvailableContests] = useState<SubContest[]>([]);
  const [importLog, setImportLog] = useState<ImportLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'import' | 'rollback' | 'recalculate'>('import');

  const [selectedSubContest, setSelectedSubContest] = useState('');
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
    
    // Get sub-contests via server action
    try {
      const contests = await getSubContests();
      setAvailableContests(contests.map((c: any) => ({
        id: c.id,
        name: c.contest_series?.name ? `${c.contest_series.name} - ${c.name}` : c.name
      })));

      // Fetch import log with joined sub_contest name
      const { data: logRes } = await supabase
        .from('contest_coursera_import_log')
        .select(`
          *,
          sub_contests(name)
        `)
        .order('imported_at', { ascending: false })
        .limit(50);
        
      if (logRes) {
        setImportLog(logRes.map((r: any) => ({
          ...r,
          sub_contest_name: r.sub_contests?.name || 'Unknown'
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('Only .xlsx files are supported.');
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
    if (!file || !selectedSubContest) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const { data: { user } } = await supabase.auth.getUser();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subContestId', selectedSubContest); // Changed from snapshotMonth
    if (user?.email) fd.append('uploadedBy', user.email);

    try {
      const res = await fetch('/api/contests/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
      } else {
        setUploadResult(json);
        setFile(null);
        setSelectedSubContest('');
        await fetchData();
      }
    } catch {
      setUploadError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Rollback ───────────────────────────────────────────────────────────────
  const handleRollback = async () => {
    if (!confirmRollback) return;
    setRollbackLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const res = await fetch('/api/contests/rollback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subContestId: confirmRollback.sub_contest_id, requestedBy: user?.email }),
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
    setRecalcLoading(row.sub_contest_id);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const res = await fetch('/api/contests/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subContestId: row.sub_contest_id, requestedBy: user?.email }),
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
            <div className="flex items-center gap-2 mb-1">
              <a href="/contests/coursera" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Dashboard
              </a>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Import Reports for Contest</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Upload Coursera XLSX exports mapped directly to a specific sub-contest.</p>
          </div>
        </div>
        <a
          href="/api/coursera/template"
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

        {/* Contest selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80">Select Sub-Contest</label>
          <div className="relative">
            <select
              value={selectedSubContest}
              onChange={e => setSelectedSubContest(e.target.value)}
              className="w-full appearance-none bg-background border border-border/80 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            >
              <option value="">Select a sub-contest…</option>
              {availableContests.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {availableContests.length === 0 && (
                <option disabled>No sub-contests created yet.</option>
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">Select the specific contest event this import applies to.</p>
        </div>

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
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" /> Import successful</div>
            <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
              <div><span className="text-muted-foreground">Rows imported</span><br /><strong>{uploadResult.rowsImported.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Learners</span><br /><strong>{uploadResult.learnersAffected.toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Duration</span><br /><strong>{formatDuration(uploadResult.durationMs)}</strong></div>
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || !selectedSubContest || uploading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {uploading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><Upload className="w-4 h-4" /> Upload and Process</>
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
          <div className="p-8 text-center text-muted-foreground text-sm">No imports yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contest</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">File</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rows</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Learners</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'all' ? importLog : importLog.filter(r => r.action === activeTab)).map((row, idx) => {
                  return (
                    <tr key={`${row.id}-${idx}`} className="border-b border-border/40 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.sub_contest_name}</td>
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
                      <td className="px-4 py-3">
                        {row.action === 'import' && row.status === 'success' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRecalculate(row)}
                              disabled={recalcLoading === row.sub_contest_id}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border/80 hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className={`w-3 h-3 ${recalcLoading === row.sub_contest_id ? 'animate-spin' : ''}`} />
                              Recalculate
                            </button>
                            <button
                              onClick={() => setConfirmRollback(row)}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
              This will permanently delete all imported data for{' '}
              <strong className="text-foreground">{confirmRollback.sub_contest_name}</strong>.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmRollback(null)}
                className="flex-1 py-2 rounded-lg border border-border/80 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
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
