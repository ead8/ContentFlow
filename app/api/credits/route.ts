import { NextRequest, NextResponse } from 'next/server'
import { getCreditBalance, getCreditTransactions } from '@/lib/services/credits'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * GET /api/credits                     -> balance and plan
 * GET /api/credits?type=transactions   -> transaction history
 *
 * Credits are only ever added by plan billing (Stripe webhook) or the free
 * monthly top-up, and only spent by the AI routes, so there is no write API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    if (searchParams.get('type') === 'transactions') {
      const limit = parseInt(searchParams.get('limit') || '50', 10) || 50
      const transactions = await getCreditTransactions(limit)
      return NextResponse.json({ success: true, data: transactions })
    }

    const balance = await getCreditBalance()
    return NextResponse.json({ success: true, data: balance })
  } catch (error) {
    return apiError(error, 'Error fetching credits')
  }
}
