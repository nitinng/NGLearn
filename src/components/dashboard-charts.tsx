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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DashboardChartsProps {
  data: any[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57']

export function DashboardCharts({ data }: DashboardChartsProps) {
  // Aggregate data for Status
  const statusData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      const status = curr.status || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value)
  }, [data])

  // Aggregate data for Campus
  const campusData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      const campus = curr.campus || 'Unknown'
      acc[campus] = (acc[campus] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value).slice(0, 7) // Top 7 campuses
  }, [data])

  // Aggregate data for Course
  const courseData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      const course = curr.course || 'Unknown'
      acc[course] = (acc[course] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value)
  }, [data])

  // Aggregate data for Gender
  const genderData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      const gender = curr.gender || 'Unknown'
      acc[gender] = (acc[gender] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value)
  }, [data])

  if (!data || data.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* Status Chart */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">Alumni Status Distribution</CardTitle>
          <CardDescription>Current status across all imported alumni</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value) => [value, 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Campus Chart */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">Top Campuses</CardTitle>
          <CardDescription>Alumni distribution by primary campus</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campusData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <RechartsTooltip 
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }} 
                contentStyle={{ borderRadius: '8px' }} 
              />
              <Bar dataKey="value" name="Alumni" radius={[4, 4, 0, 0]}>
                {campusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Course Chart */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">School Distribution</CardTitle>
          <CardDescription>Alumni across different courses/schools</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courseData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
              <RechartsTooltip cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }} />
              <Bar dataKey="value" name="Alumni" radius={[0, 4, 4, 0]}>
                {courseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gender Distribution */}
      <Card className="bg-card/60 backdrop-blur-md border-slate-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-lg">Gender Distribution</CardTitle>
          <CardDescription>Overall gender ratio among alumni</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {genderData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
