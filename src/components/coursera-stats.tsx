"use client"

import React from "react"
import { BookOpen, Clock, Award, Users } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CourseraMetrics {
  lifetime_users: number
  active_users: number
  active_alumni: number
  total_learning_hours: number
  course_completions: number
}

interface CourseraStatsProps {
  metrics: CourseraMetrics | null
}

export function CourseraStats({ metrics }: CourseraStatsProps) {
  if (!metrics) return null

  return (
    <div className="space-y-2 mt-2">
      <h2 className="text-xl font-bold tracking-tight mb-4">Coursera Learning Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Learning Hours */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Learning Hours
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 border border-blue-100 dark:border-blue-900/30">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{Math.round(metrics.total_learning_hours).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Cumulative across all users
            </p>
          </CardContent>
        </Card>

        {/* Course Completions */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Course Completions
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-500 border border-purple-100 dark:border-purple-900/30">
              <Award className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{metrics.course_completions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Total courses completed
            </p>
          </CardContent>
        </Card>

        {/* Active Learners */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Learners
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500 border border-emerald-100 dark:border-emerald-900/30">
              <Users className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{metrics.active_users.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Currently engaging with content
            </p>
          </CardContent>
        </Card>

        {/* Lifetime Users */}
        <Card className="hover:shadow-md hover:scale-[1.01] transition-all duration-300 bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Enrolled
            </CardTitle>
            <div className="h-8 w-8 rounded-md bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500 border border-orange-100 dark:border-orange-900/30">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight">{metrics.lifetime_users.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Lifetime platform users
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
