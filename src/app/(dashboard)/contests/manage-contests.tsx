"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createContestSeries, updateContestSeries, deleteContestSeries,
  createUserList, updateUserList, deleteUserList,
  createSubContest, updateSubContest, deleteSubContest
} from "./actions";
import { Loader2, Trash2, Edit, Plus, FolderTree, Users, Activity, X, ChevronDown } from "lucide-react";

export function ManageContests({
  series,
  subContests,
  userLists
}: {
  series: any[];
  subContests: any[];
  userLists: any[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View States
  const [activeForm, setActiveForm] = useState<"none" | "series" | "sub" | "list">("none");

  // Forms State - Create
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesDesc, setNewSeriesDesc] = useState("");

  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const [newSubName, setNewSubName] = useState("");
  const [newSubSeriesId, setNewSubSeriesId] = useState("");
  const [newSubListId, setNewSubListId] = useState("none");
  const [newSubStart, setNewSubStart] = useState("");
  const [newSubEnd, setNewSubEnd] = useState("");

  // Edit State
  const [editMode, setEditMode] = useState<"series" | "sub" | "list" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  // --- Handlers for Create ---

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeriesName) return toast.error("Name is required");
    setIsSubmitting(true);
    const res = await createContestSeries({ name: newSeriesName, description: newSeriesDesc });
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Series created successfully");
      setNewSeriesName("");
      setNewSeriesDesc("");
      setActiveForm("none");
    }
    setIsSubmitting(false);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName) return toast.error("Name is required");
    setIsSubmitting(true);
    const res = await createUserList({ name: newListName, description: newListDesc });
    if (res?.error) toast.error(res.error);
    else {
      toast.success("User list created successfully");
      setNewListName("");
      setNewListDesc("");
      setActiveForm("none");
    }
    setIsSubmitting(false);
  };

  const handleCreateSubContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName || !newSubSeriesId) return toast.error("Name and Series are required");
    setIsSubmitting(true);
    const data: any = { name: newSubName, series_id: newSubSeriesId };
    if (newSubListId !== "none") data.user_list_id = newSubListId;
    if (newSubStart) data.start_date = newSubStart;
    if (newSubEnd) data.end_date = newSubEnd;

    const res = await createSubContest(data);
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Sub-contest created successfully");
      setNewSubName("");
      setNewSubSeriesId("");
      setNewSubListId("none");
      setNewSubStart("");
      setNewSubEnd("");
      setActiveForm("none");
    }
    setIsSubmitting(false);
  };

  // --- Handlers for Edit/Delete ---

  const startEdit = (type: "series" | "sub" | "list", item: any) => {
    setActiveForm("none");
    setEditMode(type);
    setEditId(item.id);
    if (type === "series") setEditData({ name: item.name, description: item.description || "" });
    if (type === "list") setEditData({ name: item.name, description: item.description || "" });
    if (type === "sub") {
      setEditData({
        name: item.name,
        user_list_id: item.user_list_id || "none",
        start_date: item.start_date || "",
        end_date: item.end_date || ""
      });
    }
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditId(null);
    setEditData({});
  };

  const handleUpdate = async () => {
    if (!editId || !editMode) return;
    setIsSubmitting(true);
    let res: any;

    if (editMode === "series") {
      res = await updateContestSeries(editId, { name: editData.name, description: editData.description });
    } else if (editMode === "list") {
      res = await updateUserList(editId, { name: editData.name, description: editData.description });
    } else if (editMode === "sub") {
      const data: any = { name: editData.name };
      if (editData.user_list_id !== "none") data.user_list_id = editData.user_list_id;
      else data.user_list_id = null;
      if (editData.start_date) data.start_date = editData.start_date;
      if (editData.end_date) data.end_date = editData.end_date;
      res = await updateSubContest(editId, data);
    }

    if (res?.error) toast.error(res.error);
    else {
      toast.success("Updated successfully");
      cancelEdit();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (type: "series" | "sub" | "list", id: string) => {
    if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) return;
    setIsSubmitting(true);
    let res: any;

    if (type === "series") res = await deleteContestSeries(id);
    else if (type === "list") res = await deleteUserList(id);
    else if (type === "sub") res = await deleteSubContest(id);

    if (res?.error) toast.error(res.error);
    else toast.success("Deleted successfully");
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex justify-between items-center pb-2 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-300 dark:to-white bg-clip-text text-transparent">
            Manage Contests
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Configure series, sub-contests, and participant lists for your organization.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-md">
              <Plus className="w-4 h-4 mr-2" />
              Create
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-md">
            <DropdownMenuItem onClick={() => { setActiveForm("series"); cancelEdit(); }} className="cursor-pointer">
              <FolderTree className="w-4 h-4 mr-2 text-primary" /> Create Series
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setActiveForm("sub"); cancelEdit(); }} className="cursor-pointer">
              <Activity className="w-4 h-4 mr-2 text-blue-500" /> Create Sub-Contest
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setActiveForm("list"); cancelEdit(); }} className="cursor-pointer">
              <Users className="w-4 h-4 mr-2 text-emerald-500" /> Create User List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ============================================================== */}
      {/* 1. CONTEST SERIES */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-md">
              <FolderTree className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Contest Series</h2>
          </div>
          {activeForm === "series" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveForm("none")} className="rounded-md h-8 text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Close Form
            </Button>
          )}
        </div>

        {activeForm === "series" && (
          <Card className="border-primary/30 bg-primary/5 shadow-md rounded-md animate-in slide-in-from-top-2 mb-4">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateSeries} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="s-name" className="text-xs uppercase tracking-wider text-muted-foreground">Series Name *</Label>
                    <Input id="s-name" value={newSeriesName} onChange={e => setNewSeriesName(e.target.value)} required placeholder="e.g. NavGurukul Tech Fest" className="bg-background/50 border-border/60 rounded-md" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s-desc" className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Input id="s-desc" value={newSeriesDesc} onChange={e => setNewSeriesDesc(e.target.value)} placeholder="What is this series about?" className="bg-background/50 border-border/60 rounded-md" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="rounded-md">
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Series
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className=" p-0 border-border/50 bg-card/40 backdrop-blur-xl shadow-sm rounded-md overflow-hidden">
          <CardContent className="px-2 sm:px-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No series found.</TableCell></TableRow>}
                  {series.map(s => (
                    <React.Fragment key={s.id}>
                      <TableRow className="group hover:bg-transparent">
                        <TableCell className="font-semibold">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{s.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => startEdit("series", s)} className="rounded-md h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-md h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete("series", s.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {editMode === "series" && editId === s.id && (
                        <TableRow className="bg-background">
                          <TableCell colSpan={3} className="p-4 border-b border-border/50">
                            <div className="flex flex-col gap-4 max-w-3xl">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Name</Label>
                                  <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-background rounded-md" />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Description</Label>
                                  <Input value={editData.description || ""} onChange={e => setEditData({ ...editData, description: e.target.value })} className="bg-background rounded-md" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleUpdate} disabled={isSubmitting} size="sm" className="rounded-md">
                                  {isSubmitting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                  Save Changes
                                </Button>
                                <Button variant="ghost" onClick={cancelEdit} disabled={isSubmitting} size="sm" className="rounded-md">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>


      {/* ============================================================== */}
      {/* 2. SUB-CONTESTS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-md">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Sub-Contests</h2>
          </div>
          {activeForm === "sub" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveForm("none")} className="rounded-md h-8 text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Close Form
            </Button>
          )}
        </div>

        {activeForm === "sub" && (
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-md rounded-md animate-in slide-in-from-top-2 mb-4">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateSubContest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sc-series" className="text-xs uppercase tracking-wider text-muted-foreground">Parent Series *</Label>
                    <Select value={newSubSeriesId} onValueChange={setNewSubSeriesId} required>
                      <SelectTrigger id="sc-series" className="bg-background border-border/60 rounded-md">
                        <SelectValue placeholder="Select a series" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {series.map(s => (
                          <SelectItem key={s.id} value={s.id} className="rounded-md">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sc-name" className="text-xs uppercase tracking-wider text-muted-foreground">Sub-Contest Name *</Label>
                    <Input id="sc-name" value={newSubName} onChange={e => setNewSubName(e.target.value)} required placeholder="e.g. Week 1 Sprint" className="bg-background border-border/60 rounded-md" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sc-list" className="text-xs uppercase tracking-wider text-muted-foreground">Target User List</Label>
                    <Select value={newSubListId} onValueChange={setNewSubListId}>
                      <SelectTrigger id="sc-list" className="bg-background border-border/60 rounded-md">
                        <SelectValue placeholder="Select a user list" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        <SelectItem value="none" className="rounded-md">-- No List (Open) --</SelectItem>
                        {userLists.map(l => (
                          <SelectItem key={l.id} value={l.id} className="rounded-md">{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <div className="grid gap-2">
                    <Label htmlFor="sc-start" className="text-xs uppercase tracking-wider text-muted-foreground">Start Date</Label>
                    <Input type="date" id="sc-start" value={newSubStart} onChange={e => setNewSubStart(e.target.value)} className="bg-background border-border/60 rounded-md" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sc-end" className="text-xs uppercase tracking-wider text-muted-foreground">End Date</Label>
                    <Input type="date" id="sc-end" value={newSubEnd} onChange={e => setNewSubEnd(e.target.value)} className="bg-background border-border/60 rounded-md" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Sub-Contest
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="p-0 border-border/50 shadow-sm rounded-md overflow-hidden">
          <CardContent className="px-2 sm:px-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Parent Series</TableHead>
                    <TableHead>User List</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subContests.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No sub-contests found.</TableCell></TableRow>}
                  {subContests.map(sc => (
                    <React.Fragment key={sc.id}>
                      <TableRow className="group hover:bg-transparent">
                        <TableCell className="font-semibold">{sc.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <span className="px-2 py-1 rounded-md bg-muted/50 border border-border/40 inline-flex">
                            {series.find(s => s.id === sc.series_id)?.name || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{userLists.find(l => l.id === sc.user_list_id)?.name || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {sc.start_date || "?"} to {sc.end_date || "?"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => startEdit("sub", sc)} className="rounded-md h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-md h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete("sub", sc.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {editMode === "sub" && editId === sc.id && (
                        <TableRow className="bg-background">
                          <TableCell colSpan={5} className="p-4 border-b border-border/50">
                            <div className="flex flex-col gap-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Name</Label>
                                  <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-background rounded-md" />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">User List</Label>
                                  <Select value={editData.user_list_id} onValueChange={v => setEditData({ ...editData, user_list_id: v })}>
                                    <SelectTrigger className="bg-background rounded-md">
                                      <SelectValue placeholder="Select list" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-md">
                                      <SelectItem value="none">-- No List --</SelectItem>
                                      {userLists.map(l => (
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Start Date</Label>
                                  <Input type="date" value={editData.start_date || ""} onChange={e => setEditData({ ...editData, start_date: e.target.value })} className="bg-background rounded-md" />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">End Date</Label>
                                  <Input type="date" value={editData.end_date || ""} onChange={e => setEditData({ ...editData, end_date: e.target.value })} className="bg-background rounded-md" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleUpdate} disabled={isSubmitting} size="sm" className="rounded-md">
                                  {isSubmitting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                  Save Changes
                                </Button>
                                <Button variant="ghost" onClick={cancelEdit} disabled={isSubmitting} size="sm" className="rounded-md">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>


      {/* ============================================================== */}
      {/* 3. USER LISTS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-md">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">User Lists</h2>
          </div>
          {activeForm === "list" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveForm("none")} className="rounded-md h-8 text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Close Form
            </Button>
          )}
        </div>

        {activeForm === "list" && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-md rounded-md animate-in slide-in-from-top-2 mb-4">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateList} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="l-name" className="text-xs uppercase tracking-wider text-muted-foreground">List Name *</Label>
                    <Input id="l-name" value={newListName} onChange={e => setNewListName(e.target.value)} required placeholder="e.g. Pune Campus Users" className="bg-background/50 border-border/60 rounded-md" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="l-desc" className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                    <Input id="l-desc" value={newListDesc} onChange={e => setNewListDesc(e.target.value)} placeholder="e.g. Residential students" className="bg-background/50 border-border/60 rounded-md" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save User List
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="p-0 border-border/50 bg-card/40 backdrop-blur-xl shadow-sm rounded-md overflow-hidden">
          <CardContent className="px-2 sm:px-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userLists.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No user lists found.</TableCell></TableRow>}
                  {userLists.map(l => (
                    <React.Fragment key={l.id}>
                      <TableRow className="group hover:bg-transparent">
                        <TableCell className="font-semibold">{l.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{l.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => startEdit("list", l)} className="rounded-md h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-md h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete("list", l.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {editMode === "list" && editId === l.id && (
                        <TableRow className="bg-background">
                          <TableCell colSpan={3} className="p-4 border-b border-border/50">
                            <div className="flex flex-col gap-4 max-w-3xl">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Name</Label>
                                  <Input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-background rounded-md" />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-xs uppercase tracking-wider">Description</Label>
                                  <Input value={editData.description || ""} onChange={e => setEditData({ ...editData, description: e.target.value })} className="bg-background rounded-md" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleUpdate} disabled={isSubmitting} size="sm" className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">
                                  {isSubmitting && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                                  Save Changes
                                </Button>
                                <Button variant="ghost" onClick={cancelEdit} disabled={isSubmitting} size="sm" className="rounded-md">
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
