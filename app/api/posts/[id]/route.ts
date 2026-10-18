import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Get a single post with its publishing targets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const { data: post, error } = await supabase
      .from('content_posts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (error || !post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    const { data: targets } = await supabase
      .from('post_targets')
      .select('id, platform, status, published_at, error_message, social_account_id')
      .eq('post_id', params.id)

    return NextResponse.json({ success: true, data: { ...post, targets: targets || [] } })
  } catch (error) {
    return apiError(error, 'Error fetching post')
  }
}
