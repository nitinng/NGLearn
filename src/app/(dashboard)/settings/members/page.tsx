'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Users, RefreshCw, Trash2, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getMembers, getMemberStats, clearMembers, getMembersImportLog, updateMember, getCurrentUserRole } from './actions';
import type { NgMember, MembersImportLog } from './actions';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
  return <AlertTriangle className="w-4 h-4 text-amber-500" />;
}

const PAGE_SIZE = 50;

// ── Component ─────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const [members, setMembers] = useState<NgMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState<{ total: number; matched_coursera: number; teams: Record<string, number> } | null>(null);
  const [importLog, setImportLog] = useState<MembersImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'upload' | 'log'>('members');
  const [role, setRole] = useState<string | null>(null);
  
  // Edit state
  const [editingMember, setEditingMember] = useState<NgMember | null>(null);
  const [editForm, setEditForm] = useState<Partial<NgMember>>({});
  const [saving, setSaving] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ rowsImported: number; rowsSkipped: number; skippedDetails?: { reason: string; email?: string }[] } | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, statsRes, logRes, roleRes] = await Promise.all([
        getMembers(page, PAGE_SIZE, search),
        getMemberStats(),
        getMembersImportLog(),
        getCurrentUserRole(),
      ]);
      setMembers(membersRes.members);
      setTotal(membersRes.total);
      setStats(statsRes);
      setImportLog(logRes);
      setRole(roleRes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Upload handlers ────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/members/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setUploadResult({ rowsImported: json.rowsImported, rowsSkipped: json.rowsSkipped, skippedDetails: json.skippedDetails });
      toast.success(`Imported ${json.rowsImported} members`);
      setFile(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear ALL members? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await clearMembers();
      if (res.error) throw new Error(res.error);
      toast.success('All members cleared');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClearing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    setSaving(true);
    try {
      const res = await updateMember(editingMember.id, editForm);
      if (res.error) throw new Error(res.error);
      toast.success('Member updated');
      setEditingMember(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 rounded-xl border border-violet-500/20 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground/80">
              Manage Members
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Upload and manage the unified NG member list used across all Coursera reports and contests.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Members</p>
            <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Matched in Coursera</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.matched_coursera.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm col-span-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">By Team</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.teams).map(([team, count]) => (
                <span key={team} className="text-xs px-2 py-1 rounded-md bg-secondary/80 border border-border/60 text-muted-foreground">
                  {team}: <strong className="text-foreground">{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {(['members', 'upload', 'log'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {tab === 'log' ? 'Import Log' : tab === 'members' ? `Members (${total})` : 'Upload'}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, email, team..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alt Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No members found</td></tr>
                ) : members.map((m) => (
                  <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{m.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.alt_email || '—'}</td>
                    <td className="px-4 py-3">
                      {m.team ? (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60 text-muted-foreground">{m.team}</span>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.group_name || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {role === 'Admin' && (
                        <button
                          onClick={() => { setEditingMember(m); setEditForm(m); }}
                          className="text-xs px-3 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Clear members */}
          {total > 0 && role === 'Admin' && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {clearing ? 'Clearing…' : 'Clear All Members'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="max-w-xl space-y-6">
          <div className="rounded-xl border border-border/60 bg-card/40 p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Upload Member List</h3>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or XLSX file with the following columns:
            </p>
            <div className="flex flex-wrap gap-2">
              {['Full Name', 'Email', 'Team', 'Group'].map((col) => (
                <span key={col} className="text-xs px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono">{col}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Column headers are case-insensitive. Existing members are updated by email (upsert).
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
              dragging
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border/60 bg-card/40 hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <FileSpreadsheet className={`w-10 h-10 transition-colors ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
            {file ? (
              <div className="text-center">
                <p className="font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-medium text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">CSV or XLSX format</p>
              </div>
            )}
          </div>

          {uploadResult && (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-green-700 dark:text-green-400">Import successful</span>
                  <span className="text-muted-foreground ml-2">{uploadResult.rowsImported} imported, {uploadResult.rowsSkipped} skipped</span>
                </div>
              </div>
              
              {uploadResult.skippedDetails && uploadResult.skippedDetails.length > 0 && (
                <div className="mt-2 text-sm border-t border-green-500/20 pt-3">
                  <p className="font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Skipped Rows:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs max-h-40 overflow-y-auto">
                    {uploadResult.skippedDetails.map((detail, idx) => (
                      <li key={idx}>
                        {detail.reason} {detail.email ? `(${detail.email})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:shadow-md hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Importing…' : 'Import Members'}
          </button>
        </div>
      )}

      {/* Import Log Tab */}
      {activeTab === 'log' && (
        <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imported</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skipped</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">When</th>
              </tr>
            </thead>
            <tbody>
              {importLog.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No import history yet</td></tr>
              ) : importLog.map((row) => (
                <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3"><StatusIcon status={row.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[200px]">{row.filename || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60 text-muted-foreground capitalize">{row.action}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{row.rows_imported ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.rows_skipped ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.imported_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/60 rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Edit Member</h3>
              <button onClick={() => setEditingMember(null)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Alt Email</label>
                <input
                  type="email"
                  value={editForm.alt_email || ''}
                  onChange={e => setEditForm({ ...editForm, alt_email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Team</label>
                  <input
                    type="text"
                    value={editForm.team || ''}
                    onChange={e => setEditForm({ ...editForm, team: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Group</label>
                  <input
                    type="text"
                    value={editForm.group_name || ''}
                    onChange={e => setEditForm({ ...editForm, group_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border/60 flex justify-end gap-2 bg-muted/20">
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border/60 hover:bg-accent/50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
