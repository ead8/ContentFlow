import { NextResponse } from 'next/server'
import { getAnalyticsOverview } from '@/lib/services/analytics'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/** GET /api/analytics -> engagement overview for the current user */
export async function GET() {
  try {
    const overview = await getAnalyticsOverview()
    return NextResponse.json({ success: true, data: overview })
  } catch (error) {
    return apiError(error, 'Error fetching analytics')
  }
}
