/**
 * Browser-side billing helpers. Checkout and the customer portal run as
 * Supabase Edge Functions (supabase/functions/stripe-checkout, stripe-portal);
 * plan changes reach the app through the stripe-webhook function.
 *
 * Usage (client component):
 *   window.location.assign(await createCheckoutSession('creator'))
 *   window.location.assign(await createPortalSession())
 *
 * After checkout Stripe sends the user to /settings?billing=success (or
 * ?billing=canceled). The plan is updated by the webhook a moment later, so
 * refetch GET /api/credits when that query parameter is present.
 */
import { createClient } from '@/lib/supabase/client'
import type { PlanId } from '@/lib/billing/plans'

export type PaidPlanId = Exclude<PlanId, 'free'>

/** Error from a billing function; `code` is e.g. 'already_subscribed' or 'no_customer' */
export class BillingError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message)
    this.name = 'BillingError'
  }
}

async function callFunction(name: string, body: Record<string, unknown>): Promise<{ url?: string }> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new BillingError('Please sign in again.', 'not_authenticated', 401)
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new BillingError(data?.error || 'Billing request failed', data?.code, response.status)
  }
  return data
}

/**
 * Start Stripe Checkout for a paid plan and return the Checkout URL.
 * Throws BillingError with code 'already_subscribed' (409) when the user
 * already has a subscription; send them to createPortalSession() instead.
 */
export async function createCheckoutSession(plan: PaidPlanId, returnPath = '/settings'): Promise<string> {
  const origin = window.location.origin
  const sep = returnPath.includes('?') ? '&' : '?'
  const { url } = await callFunction('stripe-checkout', {
    plan,
    success_url: `${origin}${returnPath}${sep}billing=success`,
    cancel_url: `${origin}${returnPath}${sep}billing=canceled`,
  })
  if (!url) throw new BillingError('No checkout URL returned')
  return url
}

/**
 * Open the Stripe customer portal (change plan, cancel, payment methods,
 * invoices) and return its URL. Throws BillingError 'no_customer' (404) when
 * the user has never subscribed.
 */
export async function createPortalSession(returnPath = '/settings'): Promise<string> {
  const { url } = await callFunction('stripe-portal', {
    return_url: `${window.location.origin}${returnPath}`,
  })
  if (!url) throw new BillingError('No portal URL returned')
  return url
}

export interface ActiveSubscription {
  customer_id: string
  subscription_id: string | null
  subscription_status: string | null
  price_id: string | null
  current_period_start: number | null
  current_period_end: number | null
  cancel_at_period_end: boolean | null
  payment_method_brand: string | null
  payment_method_last4: string | null
}

/**
 * The current user's Stripe subscription row (null if they never subscribed).
 * The plan itself is profiles.plan, returned by GET /api/credits.
 */
export async function getActiveSubscription(): Promise<ActiveSubscription | null> {
  const supabase = createClient()

  const { data, error } = await supabase.from('stripe_user_subscriptions').select('*').maybeSingle()

  if (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
  return (data as ActiveSubscription | null) ?? null
}
