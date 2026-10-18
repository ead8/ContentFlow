import { NextRequest, NextResponse } from 'next/server'
import {
  recordPlatformAnalytics,
  getUserPlatformAnalytics,
  getEngagementSummary,
  getPostAnalytics,
} from '@/lib/services/analytics'
import { apiError } from '@/lib/api/error'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'summary' or 'platform'
    const platform = searchParams.get('platform')
    const days = parseInt(searchParams.get('days') || '30')

    if (type === 'summary') {
      const summary = await getEngagementSummary()
      return NextResponse.json({ success: true, data: summary })
    } else if (type === 'platform') {
      const analytics = await getUserPlatformAnalytics(platform || undefined, days)
      return NextResponse.json({ success: true, data: analytics })
    } else {
      const postId = searchParams.get('postId')
      if (postId) {
        const analytics = await getPostAnalytics(postId)
        return NextResponse.json({ success: true, data: analytics })
      }
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }
  } catch (error) {
    return apiError(error, 'Error fetching analytics')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, platform, metrics } = body

    if (!accountId || !platform || !metrics) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await recordPlatformAnalytics(accountId, platform, metrics)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Error recording analytics')
  }
}
