import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { getAnalyticsOverview } from '@/lib/services/analytics'
import { apiError } from '@/lib/api/error'

/**
 * Dashboard KPI stats computed from the user's own data.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const overview = await getAnalyticsOverview()

    // Posts created per day over the last 7 days (UTC days)
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    since.setUTCDate(since.getUTCDate() - 6)

    const { data: recentPosts, error } = await supabase
      .from('content_posts')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())

    if (error) throw error

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since)
      d.setUTCDate(since.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      const value = (recentPosts || []).filter((p) => p.created_at.slice(0, 10) === key).length
      return { name: dayNames[d.getUTCDay()], value }
    })

    return NextResponse.json({
      success: true,
      data: {
        totalPosts: overview.post_counts.total,
        scheduledPosts: overview.post_counts.scheduled,
        publishedPosts: overview.post_counts.published,
        engagementRate: overview.engagement_rate,
        impressions: overview.totals.impressions,
        weeklyData,
      },
    })
  } catch (error) {
    return apiError(error, 'Error fetching dashboard stats')
  }
}
