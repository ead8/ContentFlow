"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Eye, Heart, Loader2, MessageSquare, MousePointerClick, Share2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchAnalytics, type AnalyticsOverview } from "@/lib/api/client"
import { platformLabel } from "@/lib/platforms"

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load analytics."))
  }, [])

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <Card>
          <CardContent className="py-12 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const t = data.totals
  const hasData = t.impressions + t.likes + t.comments + t.shares + t.clicks > 0
  const chartData = data.by_platform.map((p) => ({
    name: platformLabel(p.platform),
    Likes: p.totals.likes,
    Comments: p.totals.comments,
    Shares: p.totals.shares,
    Clicks: p.totals.clicks,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          {data.post_counts.published} published · {data.post_counts.scheduled} scheduled · {data.post_counts.draft} drafts
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <MetricCard title="Impressions" value={t.impressions.toLocaleString()} icon={<Eye className="h-5 w-5" />} />
        <MetricCard title="Likes" value={t.likes.toLocaleString()} icon={<Heart className="h-5 w-5" />} />
        <MetricCard title="Comments" value={t.comments.toLocaleString()} icon={<MessageSquare className="h-5 w-5" />} />
        <MetricCard title="Shares" value={t.shares.toLocaleString()} icon={<Share2 className="h-5 w-5" />} />
        <MetricCard title="Clicks" value={t.clicks.toLocaleString()} icon={<MousePointerClick className="h-5 w-5" />} />
        <MetricCard title="Engagement rate" value={`${data.engagement_rate}%`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No results recorded yet. Open a published post in{" "}
            <Link href="/posts?status=published" className="text-primary underline-offset-4 hover:underline">
              My Posts
            </Link>{" "}
            and enter its numbers under Results.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Engagement by platform</CardTitle>
              <CardDescription>Totals across all posts with recorded results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Likes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Comments" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Shares" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Clicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top posts</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_posts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[280px] truncate">
                        <Link href={`/posts/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                      </TableCell>
                      <TableCell className="text-right">{p.totals.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.totals.likes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.totals.comments.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.engagement_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
