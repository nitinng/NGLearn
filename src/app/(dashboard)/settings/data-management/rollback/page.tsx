"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RotateCcw, 
  Trash2, 
  Clock, 
  User, 
  Info, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Calendar,
  Sparkles,
  ShieldAlert,
  Server,
  KeyRound
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ImportBatch } from '@/types/import';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const DUMMY_ELIGIBLE_BATCHES: ImportBatch[] = [
  {
    id: 'b11d87e0-4351-419b-a3d2-d81b212f84cb',
    file_name: 'ghar_export_2026_06_20.xlsx',
    file_type: 'xlsx',
    file_size: 45200,
    uploaded_by: '1',
    uploaded_by_name: 'System Admin',
    uploaded_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    records_processed: 124,
    records_created: 118,
    records_updated: 4,
    records_failed: 2,
    status: 'completed',
    notes: 'Standard monthly GHAR alumni refresh.'
  },
  {
    id: 'e44f10f3-7684-44dd-d6f5-e14e545fa7ee',
    file_name: 'placement_stats_q1_temp.csv',
    file_type: 'csv',
    file_size: 9800,
    uploaded_by: '2',
    uploaded_by_name: 'Operations Manager',
    uploaded_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    records_processed: 28,
    records_created: 12,
    records_updated: 16,
    records_failed: 0,
    status: 'completed',
    notes: 'Temporary placement status import for testing.'
  }
];

export default function RollbackCenterPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingDummy, setIsUsingDummy] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Single Record Rollback Form State
  const [email, setEmail] = useState('');
  const [tableName, setTableName] = useState<'alumni_master' | 'alumni_profile'>('alumni_master');
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [isRecordRollingBack, setIsRecordRollingBack] = useState(false);

  const supabase = createClient();

  const fetchEligibleBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('import_batches')
        .select('*')
        .in('status', ['completed'])
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setBatches(data as ImportBatch[]);
        setIsUsingDummy(false);
      } else {
        setBatches(DUMMY_ELIGIBLE_BATCHES);
        setIsUsingDummy(true);
      }
    } catch (err: any) {
      console.error(err);
      setBatches(DUMMY_ELIGIBLE_BATCHES);
      setIsUsingDummy(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligibleBatches();
  }, []);

  const handleBatchRollback = async (batchId: string, fileName: string) => {
    const confirmMsg = `Are you absolutely sure you want to roll back the import batch "${fileName}"?\n\nThis will permanently delete all records created by this batch and restore all updated records to their exact state prior to this import. This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setActionInProgress(batchId);

    if (isUsingDummy) {
      setTimeout(() => {
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'rolled_back' } : b));
        toast.success(`Mock Rollback completed for batch "${fileName}"!`);
        setActionInProgress(null);
      }, 1500);
      return;
    }

    try {
      const res = await fetch('/api/alumni/admin/import-rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importBatchId: batchId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Successfully rolled back batch. ${data.deleted} deleted, ${data.restored} restored.`);
        fetchEligibleBatches();
      } else {
        toast.error(data.error || 'Rollback failed');
      }
    } catch (err) {
      toast.error('Failed to communicate with rollback API');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRecordRollbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !targetDate || !targetTime) {
      toast.error('Please fill in all record rollback details');
      return;
    }

    const timestampStr = `${targetDate}T${targetTime}`;
    const targetTimestamp = new Date(timestampStr).toISOString();

    const confirmMsg = `Are you sure you want to restore the record "${email}" on table "${tableName}" to its state as of ${new Date(targetTimestamp).toLocaleString('en-IN')}?`;
    if (!window.confirm(confirmMsg)) return;

    setIsRecordRollingBack(true);

    if (isUsingDummy || email === 'demo@domain.com') {
      setTimeout(() => {
        toast.success(`Mock Rollback Success: Record "${email}" reverted to pre-${targetDate} state.`);
        setIsRecordRollingBack(false);
        setEmail('');
        setTargetDate('');
        setTargetTime('');
      }, 1500);
      return;
    }

    try {
      const res = await fetch('/api/alumni/admin/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: email,
          tableName,
          targetTimestamp
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Record successfully restored. Reverted fields: ${data.fieldsRestored ? data.fieldsRestored.join(', ') : 'All fields'}`);
        setEmail('');
        setTargetDate('');
        setTargetTime('');
      } else {
        toast.error(data.error || 'Restore failed');
      }
    } catch (err) {
      toast.error('Failed to trigger record rollback API');
    } finally {
      setIsRecordRollingBack(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            href="/settings/data-management" 
            className="p-2 border border-border/80 rounded-xl hover:bg-muted transition-all text-muted-foreground hover:text-foreground hover:scale-105"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rollback Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Restore single records or undo entire dataset imports. All rollback actions are fully audited.
            </p>
          </div>
        </div>
      </div>

      {isUsingDummy && (
        <Card className="border-amber-500/25 bg-amber-500/5 shadow-inner">
          <CardContent className="pt-5 pb-5 text-xs flex gap-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-sm">Demonstration Mode Enabled</p>
              <p className="mt-1 leading-relaxed">
                No active rollback-eligible batches found in the database. Showing mock imports so you can test batch rollbacks and single record reverts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Rollback Section */}
      <Card className="border border-border/85 rounded-2xl overflow-hidden shadow-md bg-card/50">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-5">
          <CardTitle className="text-lg flex items-center gap-2 font-bold">
            <Trash2 className="w-4.5 h-4.5 text-red-500" />
            Batch Rollback
          </CardTitle>
          <CardDescription>
            Revert an entire import batch. This deletes all records created by the batch and restores updated records to their pre-import state.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[50rem]">
              <thead className="bg-muted/50 border-b border-border/60">
                <tr>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Import Details</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Imported By</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-emerald-600 dark:text-emerald-400 text-center">Created</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-blue-600 dark:text-blue-400 text-center">Updated</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Status</th>
                  <th className="px-5 py-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const isProcessing = actionInProgress === batch.id;
                  const isBatchRolledBack = batch.status === 'rolled_back';

                  let borderAccent = isBatchRolledBack 
                    ? 'border-l-[4px] border-l-amber-500 hover:bg-amber-500/5'
                    : 'border-l-[4px] border-l-emerald-500 hover:bg-emerald-500/5';

                  return (
                    <tr key={batch.id} className={`border-t border-border/40 transition-colors ${borderAccent}`}>
                      <td className="px-5 py-4 space-y-1.5">
                        <p className="font-mono font-semibold text-foreground">{batch.file_name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(batch.uploaded_at).toLocaleString('en-IN')}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-muted-foreground">
                        {batch.uploaded_by_name}
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {batch.records_created}
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {batch.records_updated}
                      </td>
                      <td className="px-5 py-4">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${
                            isBatchRolledBack 
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800' 
                              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
                          }`}
                        >
                          {batch.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBatchRollback(batch.id, batch.file_name)}
                          disabled={isProcessing || isBatchRolledBack}
                          className="h-8 text-xs gap-1.5 rounded-xl transition-all hover:scale-105"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {isBatchRolledBack ? 'Rolled Back' : 'Roll Back'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground font-semibold">
                      No rollback-eligible import batches available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Rollback Section */}
      <Card className="border border-border/80 rounded-2xl shadow-md bg-card/50 overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-5">
          <CardTitle className="text-lg flex items-center gap-2 font-bold">
            <Clock className="w-4.5 h-4.5 text-indigo-500" />
            Record Rollback (Point-in-Time Restore)
          </CardTitle>
          <CardDescription>
            Restore a single record to its exact database state at a specific historical point in time.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-6">
          <form onSubmit={handleRecordRollbackSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Record Identifier (Email)
              </label>
              <Input
                placeholder="e.g. name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-muted-foreground" />
                Table Name
              </label>
              <Select value={tableName} onValueChange={(val: any) => setTableName(val)}>
                <SelectTrigger className="rounded-xl h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="alumni_master">Alumni Master (Email PK)</SelectItem>
                  <SelectItem value="alumni_profile">Alumni Profile (UUID PK)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Target State Timestamp
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="rounded-xl h-9 px-2 text-xs"
                  required
                />
                <Input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="rounded-xl h-9 px-2 text-xs"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={isRecordRollingBack} className="gap-1.5 rounded-xl h-9 transition-all hover:scale-105 font-bold text-xs">
              {isRecordRollingBack ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Restore Record State
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t border-border/60 bg-muted/10 text-xs py-3 flex gap-1.5 text-muted-foreground font-semibold">
          <Info className="w-4 h-4 text-primary shrink-0" />
          Note: This triggers a rollback operation that writes a RESTORE log. Self-reports on profiles take precedence on the client.
        </CardFooter>
      </Card>

    </div>
  );
}
