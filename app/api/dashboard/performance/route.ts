import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Recent posts with per-post engagement, for the Post Performance widget.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const { data: posts, error } = await supabase
      .from('content_posts')
      .select('id, title, content, status, media_urls, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    const postIds = (posts || []).map((p) => p.id)

    const { data: targets } = postIds.length
      ? await supabase
          .from('post_targets')
          .select('post_id, platform')
          .in('post_id', postIds)
      : { data: [] }

    const { data: analytics } = postIds.length
      ? await supabase
          .from('post_analytics')
          .select('post_id, engagement_type, count')
          .in('post_id', postIds)
      : { data: [] }

    const platformByPost = new Map<string, string>()
    for (const t of targets || []) {
      if (!platformByPost.has(t.post_id)) platformByPost.set(t.post_id, t.platform)
    }

    const engagementByPost = new Map<string, { likes: number; comments: number; reach: number }>()
    for (const a of analytics || []) {
      const agg = engagementByPost.get(a.post_id) || { likes: 0, comments: 0, reach: 0 }
      if (a.engagement_type === 'likes') agg.likes += a.count
      else if (a.engagement_type === 'comments') agg.comments += a.count
      else if (a.engagement_type === 'impressions') agg.reach += a.count
      engagementByPost.set(a.post_id, agg)
    }

    const data = (posts || []).map((p) => ({
      id: p.id,
      thumbnail: p.media_urls?.[0] || '/images/post-placeholder.svg',
      title: p.title || p.content.slice(0, 60),
      status: p.status === 'published' ? 'posted' : p.status,
      platform: platformByPost.get(p.id) || '—',
      date: p.created_at,
      engagement: engagementByPost.get(p.id),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return apiError(error, 'Error fetching post performance')
  }
}
