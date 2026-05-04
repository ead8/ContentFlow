'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users, MessageSquare, Share2 } from 'lucide-react'

interface AnalyticsData {
  total_likes: number
  total_comments: number
  total_shares: number
  total_impressions: number
  average_engagement_rate: number
}

export function AnalyticsOverview() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch('/api/analytics?type=summary')
        const result = await response.json()
        
        if (result.success) {
          setAnalytics(result.data)
        }
      } catch (error) {
        console.error('[v0] Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return <div className="text-muted-foreground">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="text-muted-foreground">Unable to load analytics</div>
  }

  const metrics = [
    {
      title: 'Total Impressions',
      value: analytics.total_impressions.toLocaleString(),
      icon: <Users className="h-5 w-5" />,
      color: 'text-accent',
    },
    {
      title: 'Likes',
      value: analytics.total_likes.toLocaleString(),
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-accent',
    },
    {
      title: 'Comments',
      value: analytics.total_comments.toLocaleString(),
      icon: <MessageSquare className="h-5 w-5" />,
      color: 'text-accent',
    },
    {
      title: 'Shares',
      value: analytics.total_shares.toLocaleString(),
      icon: <Share2 className="h-5 w-5" />,
      color: 'text-accent',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Analytics Overview</h2>
        <p className="text-muted-foreground">Your engagement metrics across all platforms</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="bg-background border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={metric.color}>{metric.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Engagement Rate</CardTitle>
          <CardDescription>Average engagement across all posts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="text-4xl font-bold text-accent">
              {analytics.average_engagement_rate.toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground mb-1">of total impressions</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
