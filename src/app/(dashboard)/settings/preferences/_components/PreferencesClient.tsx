'use client';

import { useState } from 'react';
import { updatePreferences } from '../actions';
import { Monitor } from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function PreferencesClient({ initialAllowGlobal, initialAllowGlobalLogs }: { initialAllowGlobal: boolean, initialAllowGlobalLogs: boolean }) {
  const [allowGlobal, setAllowGlobal] = useState(initialAllowGlobal);
  const [allowGlobalLogs, setAllowGlobalLogs] = useState(initialAllowGlobalLogs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleToggle = async (key: 'dashboard' | 'logs', val: boolean) => {
    if (key === 'dashboard') setAllowGlobal(val);
    else setAllowGlobalLogs(val);
    
    setSaving(true);
    setMsg('');
    const payload = key === 'dashboard' ? { allow_global_data_view: val } : { allow_global_activity_logs_view: val };
    const res = await updatePreferences(payload);
    if (res?.error) {
      setMsg(res.error);
      if (key === 'dashboard') setAllowGlobal(!val);
      else setAllowGlobalLogs(!val);
    } else {
      setMsg('Preferences updated successfully.');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      <Link href="/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Preferences</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure how the analytics dashboard presents data across the platform.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden max-w-3xl">
        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-pink-500/10 text-pink-500 rounded-lg shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Global Data View</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Allow viewers to switch between "Global" (all Coursera learners) and "Member" (only registered NG members) data on the dashboard. Turning this off will restrict the dashboard exclusively to the "Member" view, and hide the toggle switch.
                </p>
              </div>
            </div>
            <div>
              <Switch 
                checked={allowGlobal}
                onCheckedChange={(val) => handleToggle('dashboard', val)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Activity Logs Setting */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Activity Logs Global View</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Allow viewers to switch between "Global" and "Member" views on the Activity Logs page. Turning this off will restrict the logs exclusively to registered NG members.
                </p>
              </div>
            </div>
            <div>
              <Switch 
                checked={allowGlobalLogs}
                onCheckedChange={(val) => handleToggle('logs', val)}
                disabled={saving}
              />
            </div>
          </div>
          {msg && (
            <div className={`text-sm p-3 rounded-lg border ${msg.includes('out of date') || msg.includes('Failed') || msg.includes('Error') ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
