import { NextRequest, NextResponse } from 'next/server'
import { getPost, recordMetrics } from '@/lib/services/content-posts'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * POST /api/posts/:id/metrics -> save the latest engagement numbers
 * Body: { platform: string, metrics: { impressions?, likes?, comments?, shares?, clicks? } }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.platform !== 'string' || !body.metrics || typeof body.metrics !== 'object') {
      throw new ValidationError('platform and metrics are required')
    }

    await recordMetrics(params.id, body.platform, body.metrics)
    const post = await getPost(params.id)
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return apiError(error, 'Error recording metrics')
  }
}
