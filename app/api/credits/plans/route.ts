import { NextResponse } from 'next/server'
import { getPlansWithPrices } from '@/lib/billing/prices'
import { getCreditBalance } from '@/lib/services/credits'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * GET /api/credits/plans
 *   -> { plans: PlanWithPrice[], currentPlan: PlanId }
 *
 * Plans with live Stripe prices for a pricing / upgrade screen. Start a
 * purchase with createCheckoutSession(plan) from lib/stripe.ts; existing
 * subscribers change or cancel through createPortalSession().
 */
export async function GET() {
  try {
    const [plans, balance] = await Promise.all([getPlansWithPrices(), getCreditBalance()])
    return NextResponse.json({ success: true, data: { plans, currentPlan: balance.plan } })
  } catch (error) {
    return apiError(error, 'Error fetching plans')
  }
}
