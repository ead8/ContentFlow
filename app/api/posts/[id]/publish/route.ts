import { NextRequest, NextResponse } from 'next/server'
import { markPublished } from '@/lib/services/content-posts'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * POST /api/posts/:id/publish -> record the post as published
 * Body: { platforms: [{ platform: string, url?: string }] }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
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
