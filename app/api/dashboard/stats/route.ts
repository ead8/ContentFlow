import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Dashboard KPI stats computed from the user's own data.
 * Shape matches what the dashboard components expect.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const { count: totalPosts } = await supabase
      .from('content_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { data: platformMetrics } = await supabase
      .from('platform_analytics')
      .select('engagement_rate, total_impressions')
      .eq('user_id', userId)

    const rates = (platformMetrics || [])
      .map((m) => Number(m.engagement_rate))
      .filter((n) => !Number.isNaN(n))
    const impressions = (platformMetrics || [])
      .map((m) => Number(m.total_impressions))
      .filter((n) => !Number.isNaN(n))

    const engagementRate = rates.length
      ? rates.reduce((a, b) => a + b, 0) / rates.length
      : 0
    const avgReach = impressions.length
      ? impressions.reduce((a, b) => a + b, 0) / impressions.length
      : 0

    // Posts created per day over the last 7 days
    const since = new Date()
    since.setDate(since.getDate() - 6)
    const { data: recentPosts } = await supabase
      .from('content_posts')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      const value = (recentPosts || []).filter((p) =>
        p.created_at.slice(0, 10) === key
      ).length
      return { name: dayNames[d.getDay()], value }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalPosts: totalPosts || 0,
        engagementRate: Math.round(engagementRate * 100) / 100,
        avgReach: Math.round(avgReach),
        videoViews: 0,
        weeklyData,
      },
    })
  } catch (error) {
    return apiError(error, 'Error fetching dashboard stats')
  }
}
