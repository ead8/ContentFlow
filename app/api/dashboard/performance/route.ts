import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * Recent posts with per-post engagement, for the Post Performance widget.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const { data: posts, error } = await supabase
      .from('content_posts')
      .select('id, title, content, status, media_urls, platforms, scheduled_for, published_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    const postIds = (posts || []).map((p) => p.id)

    const { data: analytics } = postIds.length
      ? await supabase
          .from('post_analytics')
          .select('post_id, engagement_type, count')
          .in('post_id', postIds)
      : { data: [] }

    const engagementByPost = new Map<string, { likes: number; comments: number; reach: number }>()
    for (const a of analytics || []) {
      const agg = engagementByPost.get(a.post_id) || { likes: 0, comments: 0, reach: 0 }
      if (a.engagement_type === 'likes') agg.likes += a.count
      else if (a.engagement_type === 'comments') agg.comments += a.count
      else if (a.engagement_type === 'impressions') agg.reach += a.count
      engagementByPost.set(a.post_id, agg)
    }

    const isImage = (url: string) => !/\.(mp4|mov|webm)(\?|$)/i.test(url)

    const data = (posts || []).map((p) => ({
      id: p.id,
      thumbnail: p.media_urls?.find(isImage) || '/images/post-placeholder.svg',
      title: p.title || p.content.slice(0, 60),
      status: p.status === 'published' ? 'posted' : p.status,
      platforms: p.platforms || [],
      date: p.published_at || p.scheduled_for || p.created_at,
      engagement: engagementByPost.get(p.id),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return apiError(error, 'Error fetching post performance')
  }
}
