/**
 * Plans and credit pricing.
 *
 * Monthly credit allowances must stay in sync with
 * public.plan_monthly_credits() in
 * supabase/migrations/20261019000000_hardening_billing_media.sql.
 *
 * Prices are not hard-coded: each paid plan points at a Stripe Price via an
 * environment variable, and the amount shown to users is read from Stripe so
 * it always matches what is charged.
 */

export type PlanId = 'free' | 'creator' | 'growth' | 'agency' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  description: string
  monthlyCredits: number
  /** Name of the env var holding the Stripe Price ID (paid plans only) */
  priceEnv?: string
  features: string[]
}

/** Credits charged per AI operation */
export const CREDIT_COSTS = {
  text: 10,
  image: 25,
} as const

export type CreditKind = keyof typeof CREDIT_COSTS

function credits(n: number) {
  return `${n.toLocaleString('en-US')} AI credits every month`
}

function capacity(n: number) {
  const posts = Math.floor(n / CREDIT_COSTS.text)
  const images = Math.floor(n / CREDIT_COSTS.image)
  return `Up to ${posts.toLocaleString('en-US')} post generations or ${images.toLocaleString('en-US')} images`
}

const CORE_FEATURES = [
  'Multi-platform copy for LinkedIn, Instagram, X, Facebook, TikTok and YouTube Shorts',
  'Content calendar and scheduling reminders',
  'Media library with image and video uploads',
  'Post performance tracking',
]

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Try ContentFlow and create your first campaigns.',
    monthlyCredits: 100,
    features: [credits(100), capacity(100), ...CORE_FEATURES],
  },
  {
    id: 'creator',
    name: 'Creator Pro',
    description: 'For individual creators publishing every week.',
    monthlyCredits: 600,
    priceEnv: 'STRIPE_PRICE_CREATOR',
    features: [credits(600), capacity(600), ...CORE_FEATURES],
  },
  {
    id: 'growth',
    name: 'Growth Studio',
    description: 'For growing businesses publishing daily.',
    monthlyCredits: 2000,
    priceEnv: 'STRIPE_PRICE_GROWTH',
    features: [credits(2000), capacity(2000), ...CORE_FEATURES],
  },
  {
    id: 'agency',
    name: 'Agency Elite',
    description: 'For agencies producing content for many brands.',
    monthlyCredits: 6000,
    priceEnv: 'STRIPE_PRICE_AGENCY',
    features: [credits(6000), capacity(6000), ...CORE_FEATURES],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'High-volume content production.',
    monthlyCredits: 20000,
    priceEnv: 'STRIPE_PRICE_ENTERPRISE',
    features: [credits(20000), capacity(20000), ...CORE_FEATURES],
  },
]

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

/** Stripe Price ID configured for a plan, if any (server-side only) */
export function priceIdForPlan(plan: Plan): string | undefined {
  return plan.priceEnv ? process.env[plan.priceEnv] || undefined : undefined
}

/** Reverse lookup used by the Stripe webhook */
export function planForPriceId(priceId: string | null | undefined): Plan | undefined {
  if (!priceId) return undefined
  return PLANS.find((p) => priceIdForPlan(p) === priceId)
}
