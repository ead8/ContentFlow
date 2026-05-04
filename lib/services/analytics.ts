import { createClient } from '@/lib/supabase/server'

export interface PostAnalytic {
  id: string
  post_id: string
  platform: string
  engagement_type: string
  count: number
  recorded_at: string
}

export interface PlatformAnalytic {
  id: string
  user_id: string
  social_account_id: string
  platform: string
  metric_date: string
  followers_count: number | null
  total_impressions: number | null
  total_clicks: number | null
  total_shares: number | null
  total_comments: number | null
  total_likes: number | null
  engagement_rate: number | null
  recorded_at: string
}

/**
 * Record engagement metrics for a post
 */
export async function recordPostAnalytics(
  postId: string,
  platform: string,
  metrics: {
    likes?: number
    comments?: number
    shares?: number
    clicks?: number
    impressions?: number
  }
): Promise<void> {
  const supabase = await createClient()

  const analyticsData = [
    ...(metrics.likes ? [{ post_id: postId, platform, engagement_type: 'likes', count: metrics.likes }] : []),
    ...(metrics.comments ? [{ post_id: postId, platform, engagement_type: 'comments', count: metrics.comments }] : []),
    ...(metrics.shares ? [{ post_id: postId, platform, engagement_type: 'shares', count: metrics.shares }] : []),
    ...(metrics.clicks ? [{ post_id: postId, platform, engagement_type: 'clicks', count: metrics.clicks }] : []),
    ...(metrics.impressions ? [{ post_id: postId, platform, engagement_type: 'impressions', count: metrics.impressions }] : []),
  ]

  if (analyticsData.length === 0) return

  const { error } = await supabase
    .from('post_analytics')
    .insert(analyticsData)

  if (error) throw error
}

/**
 * Get analytics for a specific post
 */
export async function getPostAnalytics(postId: string): Promise<PostAnalytic[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('post_id', postId)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data as PostAnalytic[]
}

/**
 * Record platform-level analytics
 */
export async function recordPlatformAnalytics(
  accountId: string,
  platform: string,
  metrics: {
    followers_count?: number
    total_impressions?: number
    total_clicks?: number
    total_shares?: number
    total_comments?: number
    total_likes?: number
    engagement_rate?: number
  }
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase
    .from('platform_analytics')
    .insert({
      user_id: user.id,
      social_account_id: accountId,
      platform,
      metric_date: new Date().toISOString().split('T')[0],
      ...metrics,
    })
    .on('*', (payload) => {
      console.log('[v0] Analytics recorded:', payload)
    })

  if (error) throw error
}

/**
 * Get platform analytics for a user
 */
export async function getUserPlatformAnalytics(
  platform?: string,
  days = 30
): Promise<PlatformAnalytic[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  let query = supabase
    .from('platform_analytics')
    .select('*')
    .eq('user_id', user.id)
    .gte('metric_date', startDate.toISOString().split('T')[0])

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query
    .order('metric_date', { ascending: false })

  if (error) throw error
  return data as PlatformAnalytic[]
}

/**
 * Get engagement summary for all posts
 */
export async function getEngagementSummary(): Promise<{
  total_likes: number
  total_comments: number
  total_shares: number
  total_impressions: number
  average_engagement_rate: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('post_analytics')
    .select('engagement_type, count', { count: 'exact' })
    .in('post_id', [
      `(select id from content_posts where user_id = '${user.id}')`,
    ])

  if (error) throw error

  let summary = {
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_impressions: 0,
    average_engagement_rate: 0,
  }

  if (data && Array.isArray(data)) {
    data.forEach((item: any) => {
      const key = `total_${item.engagement_type}` as keyof typeof summary
      if (key in summary) {
        summary[key] += item.count || 0
      }
    })
  }

  return summary
}
