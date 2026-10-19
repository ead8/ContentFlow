"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchDashboardStats, type DashboardStats } from "@/lib/api/client"

export function QuickStatsSnapshot() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-muted-foreground">Unable to load stats: {error}</p>}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Total posts" value={stats?.totalPosts} />
          <StatCard title="Scheduled" value={stats?.scheduledPosts} />
          <StatCard title="Published" value={stats?.publishedPosts} />
          <StatCard
            title="Engagement rate"
            value={stats ? `${stats.engagementRate}%` : undefined}
            hint={stats && stats.impressions === 0 ? "Record results on published posts" : undefined}
          />
        </div>

        <p className="mb-2 text-sm font-medium text-muted-foreground">Posts created, last 7 days</p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.weeklyData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
              <Tooltip cursor={{ fillOpacity: 0.1 }} />
              <Bar dataKey="value" name="Posts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({ title, value, hint }: { title: string; value?: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value ?? "—"}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
