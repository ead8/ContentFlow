import { createClient } from '@/lib/supabase/server'
import { requireUserId } from './auth'
import { METRIC_TYPES, type MetricType } from './content-posts'

export type MetricTotals = Record<MetricType, number>

export interface AnalyticsOverview {
  totals: MetricTotals
  /** (likes + comments + shares + clicks) / impressions, as a percentage */
  engagement_rate: number
  by_platform: { platform: string; totals: MetricTotals; engagement_rate: number }[]
  top_posts: {
    id: string
    title: string
    status: string
    published_at: string | null
    totals: MetricTotals
    engagement_rate: number
  }[]
  post_counts: { draft: number; scheduled: number; published: number; total: number }
}

function emptyTotals(): MetricTotals {
  return Object.fromEntries(METRIC_TYPES.map((m) => [m, 0])) as MetricTotals
}

export function engagementRate(t: MetricTotals): number {
  if (!t.impressions) return 0
  const interactions = t.likes + t.comments + t.shares + t.clicks
  return Math.round((interactions / t.impressions) * 10000) / 100
}

/**
 * Engagement overview built from the metrics recorded on the user's posts.
 */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const supabase = createClient()
  const userId = await requireUserId()

  const [{ data: posts, error: postsError }, { data: metrics, error: metricsError }] =
    await Promise.all([
      supabase
        .from('content_posts')
        .select('id, title, content, status, published_at')
        .eq('user_id', userId),
      // RLS limits post_analytics to rows on the user's own posts
      supabase.from('post_analytics').select('post_id, platform, engagement_type, count'),
    ])

  if (postsError) throw postsError
  if (metricsError) throw metricsError

  const totals = emptyTotals()
  const byPlatform = new Map<string, MetricTotals>()
  const byPost = new Map<string, MetricTotals>()

  for (const m of metrics || []) {
    const type = m.engagement_type as MetricType
    if (!(METRIC_TYPES as readonly string[]).includes(type)) continue

    totals[type] += m.count

    const p = byPlatform.get(m.platform) || emptyTotals()
    p[type] += m.count
    byPlatform.set(m.platform, p)

    const post = byPost.get(m.post_id) || emptyTotals()
    post[type] += m.count
    byPost.set(m.post_id, post)
  }

  const postCounts = { draft: 0, scheduled: 0, published: 0, total: 0 }
  for (const p of posts || []) {
    postCounts.total++
    // Partially published posts are live, so they count as published
    const status = p.status === 'partially_published' ? 'published' : p.status
    if (status in postCounts && status !== 'total') {
      postCounts[status as 'draft' | 'scheduled' | 'published']++
    }
  }

  const topPosts = (posts || [])
    .filter((p) => byPost.has(p.id))
    .map((p) => {
      const t = byPost.get(p.id)!
      return {
        id: p.id,
        title: p.title || p.content.slice(0, 60),
        status: p.status,
        published_at: p.published_at,
        totals: t,
        engagement_rate: engagementRate(t),
      }
    })
    .sort((a, b) => b.totals.impressions - a.totals.impressions || b.totals.likes - a.totals.likes)
    .slice(0, 10)

  return {
    totals,
    engagement_rate: engagementRate(totals),
    by_platform: Array.from(byPlatform.entries())
      .map(([platform, t]) => ({ platform, totals: t, engagement_rate: engagementRate(t) }))
      .sort((a, b) => b.totals.impressions - a.totals.impressions),
    top_posts: topPosts,
    post_counts: postCounts,
  }
}
