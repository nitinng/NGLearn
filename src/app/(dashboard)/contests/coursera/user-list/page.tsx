'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Plus, ListPlus, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { 
  getContestSeries,
  createContestSeries,
  getSubContests, 
  getUserLists, 
  createUserList, 
  createSubContest 
} from '@/app/actions/contests';

export default function ContestManagementPage() {
  const [loading, setLoading] = useState(true);
  
  // Data
  const [series, setSeries] = useState<any[]>([]);
  const [subContests, setSubContests] = useState<any[]>([]);
  const [userLists, setUserLists] = useState<any[]>([]);
  
  // Forms
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDesc, setNewSeriesDesc] = useState('');
  const [seriesStartDate, setSeriesStartDate] = useState('');
  const [seriesEndDate, setSeriesEndDate] = useState('');
  const [creatingSeries, setCreatingSeries] = useState(false);

  const [newListName, setNewListName] = useState('');
  const [csvData, setCsvData] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  const [newSubContestName, setNewSubContestName] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [subContestStartDate, setSubContestStartDate] = useState('');
  const [subContestEndDate, setSubContestEndDate] = useState('');
  const [creatingSubContest, setCreatingSubContest] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [s, sc, ul] = await Promise.all([
          getContestSeries(),
          getSubContests(),
          getUserLists()
        ]);
        setSeries(s);
        setSubContests(sc);
        setUserLists(ul);
        if (s.length > 0) setSelectedSeriesId(s[0].id);
      } catch (e) {
        console.error('Failed to load contest data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;
    setCreatingSeries(true);
    try {
      await createContestSeries(
        newSeriesName, 
        newSeriesDesc, 
        seriesStartDate ? new Date(seriesStartDate).toISOString() : undefined,
        seriesEndDate ? new Date(seriesEndDate).toISOString() : undefined
      );
      setNewSeriesName('');
      setNewSeriesDesc('');
      setSeriesStartDate('');
      setSeriesEndDate('');
      const newS = await getContestSeries();
      setSeries(newS);
      if (newS.length === 1) setSelectedSeriesId(newS[0].id);
      alert('Contest Series created successfully!');
    } catch (e: any) {
      alert(`Error creating contest series: ${e.message}`);
    } finally {
      setCreatingSeries(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !csvData.trim()) return;
    setCreatingList(true);
    try {
      const rows = csvData.split('\n').map(r => r.trim()).filter(r => r);
      const members = rows.map(r => {
        const parts = r.split(',');
        return { email: parts[0], name: parts[1] || '' };
      });
      await createUserList(newListName, members);
      setNewListName('');
      setCsvData('');
      setUserLists(await getUserLists());
      alert('User List created successfully!');
    } catch (e: any) {
      alert(`Error creating list: ${e.message}`);
    } finally {
      setCreatingList(false);
    }
  };

  const handleCreateSubContest = async () => {
    if (!newSubContestName.trim() || !selectedSeriesId || !subContestStartDate || !subContestEndDate) return;
    setCreatingSubContest(true);
    try {
      await createSubContest(
        selectedSeriesId, 
        newSubContestName, 
        new Date(subContestStartDate).toISOString(),
        new Date(subContestEndDate).toISOString(),
        selectedListId || null
      );
      setNewSubContestName('');
      setSubContestStartDate('');
      setSubContestEndDate('');
      setSelectedListId('');
      setSubContests(await getSubContests());
      alert('Sub-Contest created successfully!');
    } catch (e: any) {
      alert(`Error creating sub-contest: ${e.message}`);
    } finally {
      setCreatingSubContest(false);
    }
  };

  if (loading) {
    return <div className="flex p-8 justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/data-management" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to Data Management
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Contest Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Create Contest Series, manage reusable User Lists, and link them to create Sub-Contest events.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">

        {/* 1. Create Contest Series */}
        <Card className="border-emerald-500/20">
          <CardHeader className="bg-emerald-500/5 border-b border-border/60">
            <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-emerald-500" /> 1. Create Contest Series</CardTitle>
            <CardDescription>Create the parent container (e.g. "Learn Along with Coursera").</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contest Name</label>
                  <input 
                    type="text" 
                    value={newSeriesName}
                    onChange={e => setNewSeriesName(e.target.value)}
                    placeholder="e.g. Learn Along with Coursera" 
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Date & Time <span className="text-muted-foreground font-normal">(Optional)</span></label>
                    <input 
                      type="datetime-local" 
                      value={seriesStartDate}
                      onChange={e => setSeriesStartDate(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">End Date & Time <span className="text-muted-foreground font-normal">(Optional)</span></label>
                    <input 
                      type="datetime-local" 
                      value={seriesEndDate}
                      onChange={e => setSeriesEndDate(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateSeries}
                  disabled={creatingSeries || !newSeriesName.trim()}
                  className="py-2 px-4 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {creatingSeries ? 'Creating...' : 'Create Contest Series'}
                </button>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Existing Contest Series</h4>
                {series.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No series created yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {series.map(s => (
                      <li key={s.id} className="text-sm flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md border border-border/50">
                        <Trophy className="w-4 h-4 text-emerald-500" /> {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Create User List */}
        <Card className="border-indigo-500/20">
          <CardHeader className="bg-indigo-500/5 border-b border-border/60">
            <CardTitle className="flex items-center gap-2"><ListPlus className="w-5 h-5 text-indigo-500" /> 2. Create User List (Optional)</CardTitle>
            <CardDescription>Upload a CSV of users to create a reusable participant list to attach to sub-contests.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">List Name</label>
                  <input 
                    type="text" 
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    placeholder="e.g. July Bootcamp Participants" 
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Participants (CSV Format)</label>
                  <textarea 
                    value={csvData}
                    onChange={e => setCsvData(e.target.value)}
                    placeholder="email,name&#10;user1@example.com,John Doe" 
                    rows={4}
                    className="w-full font-mono text-xs bg-background border border-border/80 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-y"
                  />
                  <p className="text-xs text-muted-foreground">Format: email,name (one per line). Name is optional.</p>
                </div>
                <button
                  onClick={handleCreateList}
                  disabled={creatingList || !newListName.trim() || !csvData.trim()}
                  className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {creatingList ? 'Saving...' : 'Save User List'}
                </button>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Existing User Lists</h4>
                {userLists.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No user lists created yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {userLists.map(ul => (
                      <li key={ul.id} className="text-sm flex flex-col bg-muted/50 px-3 py-2 rounded-md border border-border/50">
                        <span className="font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-500"/> {ul.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Create Sub-Contest */}
        <Card className="border-blue-500/20">
          <CardHeader className="bg-blue-500/5 border-b border-border/60">
            <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-blue-500" /> 3. Create Sub-Contest</CardTitle>
            <CardDescription>Create the specific contest event and link it to your Series and User List.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Link to Contest Series</label>
                  <select
                    value={selectedSeriesId}
                    onChange={e => setSelectedSeriesId(e.target.value)}
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  >
                    <option value="" disabled>Select a Series...</option>
                    {series.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sub-Contest Name</label>
                  <input 
                    type="text" 
                    value={newSubContestName}
                    onChange={e => setNewSubContestName(e.target.value)}
                    placeholder="e.g. Week 1 Contest" 
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Attach User List (Optional)</label>
                  <select
                    value={selectedListId}
                    onChange={e => setSelectedListId(e.target.value)}
                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  >
                    <option value="">No User List (All Learners)</option>
                    {userLists.map(ul => (
                      <option key={ul.id} value={ul.id}>{ul.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Date & Time <span className="text-destructive">*</span></label>
                    <input 
                      type="datetime-local" 
                      value={subContestStartDate}
                      onChange={e => setSubContestStartDate(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">End Date & Time <span className="text-destructive">*</span></label>
                    <input 
                      type="datetime-local" 
                      value={subContestEndDate}
                      onChange={e => setSubContestEndDate(e.target.value)}
                      className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateSubContest}
                  disabled={creatingSubContest || !newSubContestName.trim() || !selectedSeriesId || !subContestStartDate || !subContestEndDate}
                  className="py-2 px-4 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {creatingSubContest ? 'Creating...' : 'Create Sub-Contest'}
                </button>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Existing Sub-Contests</h4>
                {subContests.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No sub-contests created yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {subContests.map(sc => (
                      <li key={sc.id} className="p-3 border border-border/60 rounded-lg flex items-center justify-between bg-card hover:bg-accent/40 transition-colors">
                        <div>
                          <div className="font-medium text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /> {sc.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Series: {series.find(s => s.id === sc.series_id)?.name || 'Unknown'} | List: {sc.contest_user_lists?.name || 'None'}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
