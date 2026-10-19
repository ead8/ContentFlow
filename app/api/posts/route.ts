import { NextRequest, NextResponse } from 'next/server'
import { createPost, getUserPosts } from '@/lib/services/content-posts'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * GET /api/posts?status=&q=&limit=&offset=  -> list the user's posts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const posts = await getUserPosts({
      status: status && ['draft', 'scheduled', 'published'].includes(status) ? status : undefined,
      search: searchParams.get('q') || undefined,
      limit: parseInt(searchParams.get('limit') || '20', 10) || 20,
      offset: parseInt(searchParams.get('offset') || '0', 10) || 0,
    })
    return NextResponse.json({ success: true, data: posts })
  } catch (error) {
    return apiError(error, 'Error fetching posts')
  }
}

/**
 * POST /api/posts -> create a post
 * Body: { content?, title?, description?, platforms?, platform_variants?,
 *         media_urls?, tone?, language?, scheduled_for?, generated_by_ai? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const post = await createPost(body)
    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Error creating post')
  }
}
