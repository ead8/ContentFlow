import { NextRequest, NextResponse } from 'next/server'
import { getPost, markPublished } from '@/lib/services/content-posts'
import { requireUserId } from '@/lib/services/auth'
import { publishPostNow } from '@/lib/social/publisher'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'
// Video uploads (TikTok, YouTube) can take a while
export const maxDuration = 300

/**
 * POST /api/posts/:id/publish
 *
 * Body { mode: 'auto', platforms?: string[] }
 *   -> publish now through the user's connected accounts (all of the post's
 *      platforms, or the given subset; also used for "Retry").
 * Body { platforms: [{ platform: string, url?: string }] }
 *   -> record the post as published manually.
 *
 * Both return the post with its targets.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))

    if (body?.mode === 'auto') {
      const userId = await requireUserId()
      // Ownership check through the user's session (RLS)
      const owned = await getPost(params.id)
      if (!owned) throw new Error('Post not found')

      let platforms: string[] | undefined
      if (body.platforms !== undefined && body.platforms !== null) {
        if (!Array.isArray(body.platforms)) throw new ValidationError('platforms must be an array')
        platforms = body.platforms
          .map((p: unknown) => (typeof p === 'string' ? p : String((p as any)?.platform ?? '')))
          .filter(Boolean)
        if (platforms!.length === 0) throw new ValidationError('platforms must be a non-empty array')
      }

      await publishPostNow(params.id, userId, platforms)

      const post = await getPost(params.id)
      if (!post) throw new Error('Post not found')
      return NextResponse.json({ success: true, data: post })
    }

    if (body?.mode !== undefined) throw new ValidationError('Unknown publish mode')

    if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
      throw new ValidationError('platforms must be a non-empty array')
    }

    const entries = body.platforms.map((p: unknown) =>
      typeof p === 'string'
        ? { platform: p }
        : { platform: String((p as any)?.platform ?? ''), url: (p as any)?.url ?? null }
    )

    const post = await markPublished(params.id, entries)
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return apiError(error, 'Error publishing post')
  }
}
