import { NextResponse } from 'next/server'
import { PLANS, priceIdForPlan } from '@/lib/billing/plans'
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { apiError } from '@/lib/api/error'

export const revalidate = 300

/**
 * GET /api/billing/plans -> plans with their live Stripe prices.
 * Public (used by the landing page and the billing page).
 */
export async function GET() {
  try {
    const stripe = getStripe()
    const configured = isBillingConfigured()

    const plans = await Promise.all(
      PLANS.map(async (plan) => {
        const priceId = priceIdForPlan(plan)
        let price: { amount: number; currency: string; interval: string | null } | null = null

        if (stripe && priceId) {
          try {
            const p = await stripe.prices.retrieve(priceId)
            if (p.unit_amount !== null) {
              price = {
                amount: p.unit_amount,
                currency: p.currency,
                interval: p.recurring?.interval ?? null,
              }
            }
          } catch (err) {
            console.error(`Could not load Stripe price for plan ${plan.id}:`, err)
          }
        }

        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          monthlyCredits: plan.monthlyCredits,
          features: plan.features,
          price,
          purchasable: configured && Boolean(price),
        }
      })
    )

    return NextResponse.json({ success: true, data: { configured, plans } })
  } catch (error) {
    return apiError(error, 'Error loading plans')
  }
}
