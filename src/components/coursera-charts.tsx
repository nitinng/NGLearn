"use client"

import React, { useMemo } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface CourseraMonthlyMetric {
  month_label: string
  total_learning_hours: number
  course_completions: number
  active_users: number
}

interface CourseraChartsProps {
  metrics: CourseraMonthlyMetric[]
}

const COLORS = {
  primary: '#3b82f6', // blue-500
  secondary: '#8b5cf6', // violet-500
  tertiary: '#10b981', // emerald-500
}

export function CourseraCharts({ metrics }: CourseraChartsProps) {
  // Ensure metrics are sorted chronologically if month_label is like "2023-01" or similar
  // Assuming they are already sorted from the DB or backend.
  const data = useMemo(() => {
    return metrics || []
  }, [metrics])

  if (!data || data.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Learning Hours Trend */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">Learning Hours Trend</CardTitle>
          <CardDescription>Total learning hours per month</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month_label" tick={{ fontSize: 12 }} />
              <YAxis />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px' }} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total_learning_hours" 
                name="Learning Hours" 
                stroke={COLORS.primary} 
                strokeWidth={3}
                dot={{ r: 4, fill: COLORS.primary }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Course Completions & Active Users */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">Completions & Activity</CardTitle>
          <CardDescription>Monthly course completions and active learners</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month_label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" orientation="left" stroke={COLORS.secondary} />
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.tertiary} />
              <RechartsTooltip 
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }} 
                contentStyle={{ borderRadius: '8px' }} 
              />
              <Legend />
              <Bar yAxisId="left" dataKey="course_completions" name="Course Completions" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="active_users" name="Active Learners" fill={COLORS.tertiary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
