"use client"

import React, { useMemo } from "react"
import {
  Users,
  Layers,
  Activity,
  Info,
  CheckCircle2
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserRole, UserTeam } from "@/lib/roles"

interface DashboardStatsProps {
  initialUsers: any[]
  error?: string | null
}

const SUPER_ADMINS = ["nitin@navgurukul.org", "nitinsudarshan@gmail.com"]

export function DashboardStats({ initialUsers, error }: DashboardStatsProps) {
  // Helper to standardise user attributes (filters only Alumni)
  const users = useMemo(() => {
    return (initialUsers || [])
      .map(u => {
        const metadata = u.user_metadata || {}
        const email = u.email || ""
        const isSuper = SUPER_ADMINS.includes(email.toLowerCase())

        const appRole = (isSuper ? "Super Admin" : (metadata.role || "Viewer")) as UserRole
        const appTeam = (metadata.team || "None") as UserTeam
        const isUserAlumni = metadata.is_alumni !== false

        return {
          ...u,
          name: metadata.full_name || metadata.name || "Unknown User",
          appRole,
          appTeam,
          isUserAlumni,
          createdAtDate: new Date(u.created_at),
          lastSignInDate: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
        }
      })
      .filter(user => user.isUserAlumni) // Filter ONLY Alumni members!
  }, [initialUsers])

  // General stats summaries
  const stats = useMemo(() => {
    const total = users.length
    const activated = users.filter(u => u.lastSignInDate !== null).length
    const withTeam = users.filter(u => u.appTeam !== "None").length

    // Active in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const activeRecently = users.filter(u => u.lastSignInDate && u.lastSignInDate >= sevenDaysAgo).length

    const activationPercentage = total > 0 ? Math.round((activated / total) * 100) : 0
    const teamPercentage = total > 0 ? Math.round((withTeam / total) * 100) : 0
    const activePercentage = total > 0 ? Math.round((activeRecently / total) * 100) : 0

    return {
      total,
      activated,
      activationPercentage,
      withTeam,
      teamPercentage,
      activeRecently,
      activePercentage
    }
  }, [users])

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-950/50 bg-red-50/50 dark:bg-red-950/10 p-6 rounded-md">
        <div className="flex gap-3 items-start text-red-700 dark:text-red-400">
          <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg">Failed to load statistics</h3>
            <p className="text-sm mt-1 opacity-90">{error}</p>
            <p className="text-xs mt-2 text-muted-foreground">
              Please verify your Supabase service credentials or database schema.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Alumni */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Alumni
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 border border-indigo-100 dark:border-indigo-900/30">
              <Users className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Active Alumni members
            </p>
          </CardContent>
        </Card>

        {/* Activation Rate */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Activation Rate
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 border border-emerald-100 dark:border-emerald-900/30">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">
              {stats.activated} <span className="text-sm font-bold text-muted-foreground">/ {stats.total}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold border-none text-[9px] h-4.5 py-0">
                {stats.activationPercentage}%
              </Badge> have logged in at least once
            </p>
          </CardContent>
        </Card>

        {/* Team Assignments */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Team Coverage
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-pink-500 border border-pink-100 dark:border-pink-900/30">
              <Layers className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{stats.withTeam}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <Badge className="bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-400 font-bold border-none text-[9px] h-4.5 py-0">
                {stats.teamPercentage}%
              </Badge> assigned to functional teams
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Recently
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 border border-amber-100 dark:border-amber-900/30">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{stats.activeRecently}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-bold border-none text-[9px] h-4.5 py-0">
                {stats.activePercentage}%
              </Badge> logged in within last 7 days
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
