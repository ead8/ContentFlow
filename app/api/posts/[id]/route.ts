import { NextRequest, NextResponse } from 'next/server'
import { deletePost, getPost, updatePost } from '@/lib/services/content-posts'
import { apiError } from '@/lib/api/error'

type Params = { params: { id: string } }

/** GET /api/posts/:id -> post with publish targets and metrics */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const post = await getPost(params.id)
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return apiError(error, 'Error fetching post')
  }
}

/**
 * PATCH /api/posts/:id -> update editable fields
 * Body: { title?, description?, content?, platforms?, platform_variants?,
 *         media_urls?, scheduled_for? (ISO or null), status?: 'draft' }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json().catch(() => ({}))
    const post = await updatePost(params.id, body)
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return apiError(error, 'Error updating post')
  }
}

/** DELETE /api/posts/:id */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deletePost(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error deleting post')
  }
}
