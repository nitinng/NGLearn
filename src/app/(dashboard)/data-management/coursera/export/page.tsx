'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileDown,
  Download,
  FileSpreadsheet,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Loader2,
  Trash2,
  ArrowLeft,
  LayoutDashboard,
  Plus,
  UsersRound,
} from 'lucide-react';
import { describePeriod } from '@/lib/report-periods';

interface AvailableMonth {
  month: string;
}

interface MonthOverview {
  totalLearners: number;
  activeLearners: number;
  totalHours: number;
  totalCompletions: number;
}

interface CohortSummary {
  id: string;
  name: string;
  member_count: number;
  created_at: string;
}

interface ParsedSheet {
  sheet: string;
  members: { full_name: string | null; email: string }[];
  invalidRows: number;
  duplicateRows: number;
}


export default function ExportCourseraActivityPage() {
  // State
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthOverview, setMonthOverview] = useState<MonthOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Learner scope = a cohort, or importing a new one
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState(false);

  // Import-cohort state
  const [parsingFile, setParsingFile] = useState(false);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);
  const [parsedSheets, setParsedSheets] = useState<(ParsedSheet & { name: string; include: boolean })[]>([]);
  const [savingCohorts, setSavingCohorts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options & export state
  const [includeMemberDetailsSheet, setIncludeMemberDetailsSheet] = useState(true);
  const [includeCourseBreakdown, setIncludeCourseBreakdown] = useState(true);
  const [includeUnmatchedSheet, setIncludeUnmatchedSheet] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    total: number;
    foundCount: number;
    notFoundCount: number;
    memberCount?: number;
    activeMemberCount?: number;
    inactiveMemberCount?: number;
    invitedCount?: number;
    notInvitedCount?: number;
    found: Array<{
      email: string;
      name: string | null;
      inSelectedMonth: boolean;
      memberStatus?: 'Member' | 'Invited' | 'Not Invited';
      activityStatus?: 'Active' | 'Inactive' | 'NA';
      enrolledCourses?: number;
      source?: string;
      enrollmentDate?: string;
      lastActivityDate?: string;
    }>;
    notFound: Array<{
      email: string;
      name?: string | null;
      memberStatus?: 'Member' | 'Invited' | 'Not Invited';
      activityStatus?: 'Active' | 'Inactive' | 'NA';
      enrolledCourses?: number;
      reason: string;
    }>;
    selectedMonth: string | null;
  } | null>(null);
  const [showMissingList, setShowMissingList] = useState(false);
  const [showFoundList, setShowFoundList] = useState(false);

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId) ?? null;

  // Fetch available weekly snapshots
  const fetchMonths = useCallback(async () => {
    setLoadingMonths(true);
    try {
      const res = await fetch('/api/coursera/metrics/available-months');
      const data: AvailableMonth[] = res.ok ? await res.json() : [];
      setAvailableMonths(data);
      if (data.length > 0) setSelectedMonth(data[0].month);
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  const fetchCohorts = useCallback(async (selectId?: string) => {
    setLoadingCohorts(true);
    try {
      const res = await fetch('/api/coursera/cohorts');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(json.error ?? 'Could not load cohorts.');
        return;
      }
      const list: CohortSummary[] = json.cohorts ?? [];
      setCohorts(list);
      setSelectedCohortId(prev => selectId ?? (prev && list.some(c => c.id === prev) ? prev : list[0]?.id ?? null));
      if (list.length === 0) setImportMode(true);
    } finally {
      setLoadingCohorts(false);
    }
  }, []);

  // Numbers for the selected cohort in the selected snapshot
  const fetchMonthOverview = useCallback(async (month: string, cohortId: string | null) => {
    if (!month || month === 'all' || !cohortId) {
      setMonthOverview(null);
      return;
    }
    setLoadingOverview(true);
    try {
      const res = await fetch(`/api/coursera/metrics?month=${encodeURIComponent(month)}&cohort=${encodeURIComponent(cohortId)}`);
      if (!res.ok) {
        setMonthOverview(null);
        return;
      }
      const { metrics } = await res.json();
      setMonthOverview({
        totalLearners: Number(metrics?.total_learners) || 0,
        activeLearners: Number(metrics?.active_learners) || 0,
        totalHours: Number(metrics?.monthly_hours) || 0,
        totalCompletions: Number(metrics?.monthly_completions) || 0,
      });
    } catch {
      setMonthOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    fetchMonths();
    fetchCohorts();
  }, [fetchMonths, fetchCohorts]);

  useEffect(() => {
    if (selectedMonth) {
      fetchMonthOverview(selectedMonth, importMode ? null : selectedCohortId);
    }
  }, [selectedMonth, selectedCohortId, importMode, fetchMonthOverview]);

  // Import cohort: read the workbook (one cohort per sheet) for preview
  const handleCohortFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMessage('Upload an .xlsx file with Full Name and Email columns.');
      return;
    }
    setParsingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/coursera/cohorts/parse', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(json.error ?? 'Could not read the file.');
        return;
      }
      const existing = new Set(cohorts.map(c => c.name.toLowerCase()));
      setParsedSheets((json.sheets as ParsedSheet[]).map(sh => ({
        ...sh,
        name: sh.sheet,
        include: sh.members.length > 0 && !existing.has(sh.sheet.toLowerCase()),
      })));
      setParsedFileName(file.name);
    } catch {
      setErrorMessage('Network error while reading the file.');
    } finally {
      setParsingFile(false);
    }
  };

  const clearParsedFile = () => {
    setParsedSheets([]);
    setParsedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveCohorts = async () => {
    const toSave = parsedSheets.filter(sh => sh.include);
    if (!toSave.length) {
      setErrorMessage('Tick at least one sheet to import.');
      return;
    }
    if (toSave.some(sh => !sh.name.trim())) {
      setErrorMessage('Every cohort needs a name.');
      return;
    }
    const existing = new Set(cohorts.map(c => c.name.toLowerCase()));
    const replacing = toSave.filter(sh => existing.has(sh.name.trim().toLowerCase()));
    if (replacing.length && !confirm(`Replace the member list of ${replacing.map(r => `"${r.name}"`).join(', ')}?`)) return;

    setSavingCohorts(true);
    setErrorMessage(null);
    const saved: string[] = [];
    let lastId: string | undefined;
    try {
      for (const sh of toSave) {
        const res = await fetch('/api/coursera/cohorts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sh.name.trim(), members: sh.members, replace: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMessage(`${sh.name}: ${json.error ?? 'could not be saved.'}`);
          break;
        }
        saved.push(`${sh.name.trim()} (${json.members})`);
        lastId = json.cohortId;
      }
      if (saved.length) {
        setSuccessMessage(`Saved cohort${saved.length > 1 ? 's' : ''}: ${saved.join(', ')}`);
        clearParsedFile();
        setImportMode(false);
        setVerificationResult(null);
        await fetchCohorts(lastId);
      }
    } finally {
      setSavingCohorts(false);
    }
  };

  const deleteCohort = async (c: CohortSummary) => {
    if (!confirm(`Delete cohort "${c.name}" and its member list? Coursera data is not affected.`)) return;
    const res = await fetch(`/api/coursera/cohorts/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setErrorMessage((await res.json().catch(() => ({}))).error ?? 'Delete failed.');
      return;
    }
    setVerificationResult(null);
    await fetchCohorts();
  };

  // Verify whether the cohort's learners exist in Coursera snapshots / live roster
  const handleVerifyUsers = async () => {
    if (!selectedCohortId) {
      setErrorMessage('Pick a cohort first.');
      return;
    }
    setVerifying(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/coursera/export/verify-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId: selectedCohortId, month: selectedMonth || 'all' }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error ?? 'Failed to verify users against Coursera records.');
        setVerificationResult(null);
      } else {
        setVerificationResult(json);
        if (json.notFoundCount > 0) {
          setShowMissingList(true);
        }
      }
    } catch {
      setErrorMessage('Network error while verifying users.');
    } finally {
      setVerifying(false);
    }
  };

  // Trigger export
  const handleExport = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedCohortId) {
      setErrorMessage('Pick a cohort to export.');
      return;
    }

    setExporting(true);

    try {
      const res = await fetch('/api/coursera/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth || 'all',
          userScope: 'cohort',
          cohortId: selectedCohortId,
          includeMemberDetailsSheet,
          includeCourseBreakdown,
          includeUnmatchedSheet,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        setErrorMessage(errorJson.error ?? `Export failed with status ${res.status}`);
        return;
      }

      // Download the stream as a file
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = `Coursera_Activity_Report_${selectedCohort?.name ?? 'cohort'}_${selectedMonth || 'all'}.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Activity report exported successfully with Member Details and Dashboard sheets!');
    } catch {
      setErrorMessage('Network error while exporting report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/data-management/coursera"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Coursera
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link
              href="/data-management/coursera/activity-logs"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View Activity Logs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shadow-inner">
              <FileDown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Export Activity Report</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Generate formatted Excel reports with Member Details, Dashboard summary cards, learning hours, and course breakdowns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
        
        {/* Step 1: Select Month */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center justify-between">
            <span>1. Select Weekly Snapshot</span>
            {loadingMonths && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading snapshots...
              </span>
            )}
          </label>

          <div className="relative max-w-md">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setVerificationResult(null);
              }}
              disabled={loadingMonths}
              className="w-full appearance-none bg-background border border-border/80 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {availableMonths.map((m) => (
                <option key={m.month} value={m.month}>
                  {describePeriod(m.month, availableMonths[availableMonths.length - 1]?.month).label}
                </option>
              ))}
              <option value="all">All snapshots (full history)</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground">
            Choose which weekly snapshot to report on. Hours are the hours learned since the previous snapshot. Pick &ldquo;All snapshots&rdquo; for the full history. The numbers below are for the selected cohort.
          </p>

          {/* Month Snapshot Metrics Preview Cards */}
          {monthOverview && !verificationResult && (
            <div className="pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" /> Cohort Learners in Snapshot
                  </span>
                  <p className="text-lg font-bold text-foreground">
                    {loadingOverview ? '—' : monthOverview.totalLearners.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Active Learners
                  </span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {loadingOverview ? '—' : monthOverview.activeLearners.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" /> Total Hours
                  </span>
                  <p className="text-lg font-bold text-foreground">
                    {loadingOverview ? '—' : `${monthOverview.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /> Completions
                  </span>
                  <p className="text-lg font-bold text-foreground">
                    {loadingOverview ? '—' : monthOverview.totalCompletions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Select Cohort */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <label className="text-sm font-semibold text-foreground flex items-center justify-between">
            <span>2. Learner Scope: Cohort</span>
            {loadingCohorts && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading cohorts...
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cohorts.map(c => {
              const active = !importMode && selectedCohortId === c.id;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedCohortId(c.id);
                    setImportMode(false);
                    setVerificationResult(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCohortId(c.id);
                      setImportMode(false);
                      setVerificationResult(null);
                    }
                  }}
                  className={`group relative p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border/60 bg-background/50 hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <UsersRound className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground block truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.member_count.toLocaleString()} learners</span>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      deleteCohort(c);
                    }}
                    aria-label={`Delete ${c.name}`}
                    className="absolute right-2 top-2 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setImportMode(true);
                setVerificationResult(null);
              }}
              className={`p-4 rounded-xl border border-dashed text-left transition flex items-start gap-3 ${
                importMode
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border/80 bg-background/50 hover:bg-muted/40 hover:border-border'
              }`}
            >
              <Plus className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sm text-foreground block">Import Cohort</span>
                <span className="text-xs text-muted-foreground">Name a cohort and upload Full Name + Email ID (.xlsx)</span>
              </div>
            </button>
          </div>

          <div className="pt-2">
            {importMode && (
              <div className="space-y-3 bg-muted/20 border border-border/60 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-foreground block">Upload cohort list (.xlsx)</span>
                    <span className="text-[11px] text-muted-foreground">
                      Columns: &apos;Full Name&apos; and an email column (e.g. &apos;NG email ID&apos;). Each sheet becomes one cohort, named after the sheet; you can rename it below.
                    </span>
                  </div>
                  <a
                    href="/templates/cohort_import_template.xlsx"
                    download
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Template (.xlsx)
                  </a>
                </div>

                {!parsedFileName ? (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-xl p-6 bg-background/50 hover:bg-muted/30 transition cursor-pointer relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleCohortFile(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {parsingFile ? (
                      <Loader2 className="w-8 h-8 text-muted-foreground mb-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground mb-2" />
                    )}
                    <span className="text-xs font-medium text-foreground">
                      {parsingFile ? 'Reading file…' : 'Click to browse or drag & drop the cohort spreadsheet'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate">{parsedFileName}</span>
                      <button type="button" onClick={clearParsedFile} className="text-muted-foreground hover:text-destructive p-1 rounded transition" aria-label="Clear file">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {parsedSheets.map((sh, idx) => {
                      const exists = cohorts.some(c => c.name.toLowerCase() === sh.name.trim().toLowerCase());
                      return (
                        <div key={sh.sheet} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-background border border-border/60">
                          <input
                            type="checkbox"
                            checked={sh.include}
                            disabled={sh.members.length === 0}
                            onChange={e => setParsedSheets(prev => prev.map((p, i) => (i === idx ? { ...p, include: e.target.checked } : p)))}
                            className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                            aria-label={`Import sheet ${sh.sheet}`}
                          />
                          <input
                            value={sh.name}
                            onChange={e => setParsedSheets(prev => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                            placeholder="Cohort name"
                            className="flex-1 min-w-0 text-sm px-3 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {sh.members.length} learners
                            {sh.invalidRows > 0 && ` · ${sh.invalidRows} rows without email skipped`}
                            {sh.duplicateRows > 0 && ` · ${sh.duplicateRows} duplicates merged`}
                            {exists && <span className="text-amber-600"> · replaces existing</span>}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={saveCohorts}
                        disabled={savingCohorts || !parsedSheets.some(sh => sh.include)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition disabled:opacity-50"
                      >
                        {savingCohorts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Save cohort{parsedSheets.filter(sh => sh.include).length > 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification for the selected cohort */}
            {!importMode && selectedCohort && (
              <div className="mt-1 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Check whether the {selectedCohort.member_count} learner(s) in {selectedCohort.name} exist in Coursera snapshots or the live enterprise roster before exporting.
                  </p>
                  <button
                    type="button"
                    onClick={handleVerifyUsers}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium transition shrink-0"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        Verify Users
                      </>
                    )}
                  </button>
                </div>

                {/* Verification Results & Live Dashboard Cards */}
                {verificationResult && (
                  <div className="p-4 rounded-xl bg-card border border-border/60 shadow-sm space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <LayoutDashboard className="w-3.5 h-3.5 text-primary" /> Scope Dashboard Breakdown
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Scope: {verificationResult.total} emails
                      </span>
                    </div>

                    {/* 5-Card Status Dashboard Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3 text-primary" /> Total
                        </span>
                        <p className="text-base font-bold text-foreground">{verificationResult.total}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-600" /> Active (&le;30d)
                        </span>
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                          {verificationResult.activeMemberCount ?? 0}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <UserMinus className="w-3 h-3 text-amber-600" /> Inactive (&gt;30d)
                        </span>
                        <p className="text-base font-bold text-amber-700 dark:text-amber-300">
                          {verificationResult.inactiveMemberCount ?? 0}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                          <UserX className="w-3 h-3 text-blue-600" /> Invited (Pending)
                        </span>
                        <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                          {verificationResult.invitedCount ?? 0}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                          <UserX className="w-3 h-3 text-rose-600" /> Not Invited
                        </span>
                        <p className="text-base font-bold text-rose-700 dark:text-rose-300">
                          {verificationResult.notInvitedCount ?? 0}
                        </p>
                      </div>
                    </div>

                    {/* Matched Users Toggle & List */}
                    {verificationResult.foundCount > 0 && (
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowFoundList(!showFoundList)}
                          className="flex items-center justify-between w-full text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline text-left"
                        >
                          <span>
                            {showFoundList ? 'Hide' : 'Show'} {verificationResult.foundCount} confirmed Coursera member(s)
                          </span>
                          {showFoundList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showFoundList && (
                          <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            {verificationResult.found.map(f => (
                              <div key={f.email} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 px-2.5 rounded bg-background/80 border border-border/50 gap-1.5 sm:gap-4">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-foreground truncate">{f.email}</span>
                                  {f.name && <span className="text-muted-foreground text-[11px] truncate">({f.name})</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                                  {f.enrolledCourses !== undefined && f.enrolledCourses > 0 && (
                                    <span>Courses: <strong className="font-medium text-foreground">{f.enrolledCourses}</strong></span>
                                  )}
                                  {f.lastActivityDate && f.lastActivityDate !== '—' && (
                                    <span>Last Active: <strong className="font-medium text-foreground">{f.lastActivityDate}</strong></span>
                                  )}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                    Member
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    f.activityStatus === 'Active'
                                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold'
                                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  }`}>
                                    {f.activityStatus === 'Active' ? 'Active (<= 30d)' : 'Inactive (> 30d)'}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    f.source?.includes('Live API')
                                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {f.source || 'Snapshots'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Missing / Unmatched users list */}
                    {verificationResult.notFoundCount > 0 && (
                      <div className="space-y-2 pt-1 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => setShowMissingList(!showMissingList)}
                          className="flex items-center justify-between w-full text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline text-left"
                        >
                          <span>
                            {showMissingList ? 'Hide' : 'Show'} {verificationResult.notFoundCount} email(s) with no Coursera account
                          </span>
                          {showMissingList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showMissingList && (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                            {verificationResult.notFound.map(nf => (
                              <div key={nf.email} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 px-2.5 rounded bg-background/80 border border-border/50 gap-1.5 sm:gap-4">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-foreground truncate">{nf.email}</span>
                                  {nf.name && <span className="text-muted-foreground text-[11px] truncate">({nf.name})</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    nf.memberStatus === 'Invited'
                                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  }`}>
                                    {nf.memberStatus || 'Not Invited'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                    Activity: NA
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Options */}
        <div className="pt-2 border-t border-border/40 space-y-2">
          <label className="text-sm font-semibold text-foreground">
            3. Report Output Structure
          </label>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include-member-details"
                checked={includeMemberDetailsSheet}
                onChange={e => setIncludeMemberDetailsSheet(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
              />
              <label htmlFor="include-member-details" className="text-sm text-foreground cursor-pointer select-none">
                Include Member Details Sheet <span className="text-xs text-muted-foreground">(adds a dedicated worksheet summarizing Member, Inactive, and Invited statuses, enrolled courses, and KPI dashboard summary cards)</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include-course-breakdown"
                checked={includeCourseBreakdown}
                onChange={e => setIncludeCourseBreakdown(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
              />
              <label htmlFor="include-course-breakdown" className="text-sm text-foreground cursor-pointer select-none">
                Include Course-Level Breakdown Sheet <span className="text-xs text-muted-foreground">(adds a worksheet with individual course enrollments, hours, and grades)</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="include-unmatched-sheet"
                checked={includeUnmatchedSheet}
                onChange={e => setIncludeUnmatchedSheet(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
              />
              <label htmlFor="include-unmatched-sheet" className="text-sm text-foreground cursor-pointer select-none">
                Include Unmatched / No Coursera Account Sheet <span className="text-xs text-muted-foreground">(adds a worksheet listing requested users who do not exist or have no Coursera records)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Feedback banners */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in duration-200">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Export action */}
        <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {selectedCohort && !importMode
              ? `Exporting ${selectedCohort.member_count} learner(s) in ${selectedCohort.name}.`
              : 'Pick a cohort to export.'}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loadingMonths || importMode || !selectedCohortId}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Export Activity Report (.xlsx)
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
