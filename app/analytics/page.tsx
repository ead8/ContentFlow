"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Heart, MessageSquare, Share2, Eye, Loader2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardPost } from "@/lib/n8n/client"

interface EngagementSummary {
  total_likes: number
  total_comments: number
  total_shares: number
  total_impressions: number
  average_engagement_rate: number
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<EngagementSummary | null>(null)
  const [posts, setPosts] = useState<DashboardPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, p] = await Promise.all([
          api<EngagementSummary>("/api/analytics?type=summary"),
          api<DashboardPost[]>("/api/dashboard/performance"),
        ])
        setSummary(s)
        setPosts(p)
      } catch (e: any) {
        setError(e.message || "Failed to load analytics.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Analytics</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = posts.map((p) => ({
    name: (p.title || "Untitled").slice(0, 18),
    likes: p.engagement?.likes || 0,
    comments: p.engagement?.comments || 0,
    reach: p.engagement?.reach || 0,
  }))

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Impressions"
          value={(summary?.total_impressions || 0).toLocaleString()}
          icon={<Eye className="h-5 w-5" />}
        />
        <MetricCard
          title="Likes"
          value={(summary?.total_likes || 0).toLocaleString()}
          icon={<Heart className="h-5 w-5" />}
        />
        <MetricCard
          title="Comments"
          value={(summary?.total_comments || 0).toLocaleString()}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <MetricCard
          title="Shares"
          value={(summary?.total_shares || 0).toLocaleString()}
          icon={<Share2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Engagement Rate"
          value={`${summary?.average_engagement_rate || 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engagement by Post</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No engagement data yet. Publish posts and record metrics to see them here.
            </p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="likes" fill="#0ea5e9" name="Likes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comments" fill="#8b5cf6" name="Comments" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reach" fill="#2dd4bf" name="Reach" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
