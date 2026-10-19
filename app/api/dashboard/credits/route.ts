import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditBalance } from '@/lib/services/credits'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * Credit balance plus what was spent this month, for the dashboard widget.
 */
export async function GET() {
  try {
    const balance = await getCreditBalance()
    const supabase = createClient()

    const since = new Date(balance.credits_refreshed_at)
    const { data: spent, error } = await supabase
      .from('credit_transactions')
      .select('amount, kind')
      .eq('transaction_type', 'deduction')
      .gte('created_at', since.toISOString())

    if (error) throw error

    const usedBy = { text: 0, image: 0, video: 0 }
    for (const t of spent || []) {
      const k = (t.kind || 'text') as keyof typeof usedBy
      if (k in usedBy) usedBy[k] += Math.abs(t.amount)
    }

    const nextRefresh = new Date(since)
    nextRefresh.setMonth(nextRefresh.getMonth() + 1)

    return NextResponse.json({
      success: true,
      data: {
        ...balance,
        used_this_period: usedBy.text + usedBy.image + usedBy.video,
        used_by_kind: usedBy,
        next_refresh_at: nextRefresh.toISOString(),
      },
    })
  } catch (error) {
    return apiError(error, 'Error fetching credit usage')
  }
}
