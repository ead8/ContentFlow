import { PLANS, PlanId, priceIdForPlan } from '@/lib/billing/plans'

export interface PlanPrice {
  /** Smallest currency unit (e.g. cents) */
  amount: number
  currency: string
  interval: string | null
}

export interface PlanWithPrice {
  id: PlanId
  name: string
  description: string
  monthlyCredits: number
  features: string[]
  /** Live price from Stripe; null for the free plan or when unavailable */
  price: PlanPrice | null
  /** True when the plan can be bought (free plan: false) */
  purchasable: boolean
}

function stripeSecret(): string | undefined {
  return process.env.STRIPE_SECRET_KEY || process.env.NEXT_PRIVATE_STRIPE_SECRET_KEY || undefined
}

async function fetchPrice(priceId: string, secret: string): Promise<PlanPrice | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      // Prices rarely change; cache for an hour.
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      console.error(`Stripe price ${priceId} lookup failed (${res.status})`)
      return null
    }
    const price = (await res.json()) as {
      unit_amount: number | null
      currency: string
      recurring: { interval: string } | null
      active: boolean
    }
    if (!price.active || price.unit_amount == null) return null
    return { amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval ?? null }
  } catch (error) {
    console.error(`Stripe price ${priceId} lookup failed:`, error)
    return null
  }
}

/**
 * All plans with the amount Stripe will actually charge. A paid plan is
 * purchasable when its STRIPE_PRICE_* env var is set; the amount is shown only
 * when STRIPE_SECRET_KEY is also available to the Next.js server.
 */
export async function getPlansWithPrices(): Promise<PlanWithPrice[]> {
  const secret = stripeSecret()

  return Promise.all(
    PLANS.map(async (plan) => {
      const priceId = priceIdForPlan(plan)
      const price = priceId && secret ? await fetchPrice(priceId, secret) : null
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        monthlyCredits: plan.monthlyCredits,
        features: plan.features,
        price,
        purchasable: Boolean(priceId),
      }
    })
  )
}
