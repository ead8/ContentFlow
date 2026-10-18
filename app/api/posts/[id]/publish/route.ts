import { NextRequest, NextResponse } from 'next/server'
import { publishPost } from '@/lib/services/content-posts'
import { apiError } from '@/lib/api/error'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { targetAccountIds } = body

    if (!params.id) {
      return NextResponse.json(
        { success: false, error: 'Post ID required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(targetAccountIds) || targetAccountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'targetAccountIds must be a non-empty array' },
        { status: 400 }
      )
    }

    await publishPost(params.id, targetAccountIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error publishing post')
  }
}
