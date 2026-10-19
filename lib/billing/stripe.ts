import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlan, planForPriceId, type PlanId } from './plans'

let stripeClient: Stripe | null = null

/** Stripe client, or null when billing is not configured */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!stripeClient) {
    stripeClient = new Stripe(key, { appInfo: { name: 'ContentFlow' } })
  }
  return stripeClient
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function requireStripe(): Stripe {
  const stripe = getStripe()
  if (!stripe || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Billing is not configured')
  }
  return stripe
}

/**
 * Find or create the Stripe customer for a user, keeping the mapping in
 * stripe_customers.
 */
export async function getOrCreateCustomer(userId: string, email: string | undefined): Promise<string> {
  const stripe = requireStripe()
  const admin = createAdminClient()

  const { data: existing, error } = await admin
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (existing?.customer_id) return existing.customer_id

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  const { error: insertError } = await admin
    .from('stripe_customers')
    .insert({ user_id: userId, customer_id: customer.id })

  if (insertError) {
    await stripe.customers.del(customer.id).catch(() => undefined)
    throw insertError
  }

  return customer.id
}

/**
 * User linked to a Stripe customer: the stripe_customers mapping, else the
 * userId we stamped on the customer / checkout session (never by email).
 * A found metadata link is saved so later events resolve directly.
 */
async function userIdForCustomer(customerId: string, hintUserId?: string | null): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .maybeSingle()
  if (data?.user_id) return data.user_id

  let userId = hintUserId || null
  if (!userId) {
    const customer = await requireStripe().customers.retrieve(customerId)
    if (!customer.deleted) userId = customer.metadata?.userId || customer.metadata?.user_id || null
  }
  if (!userId) return null

  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!profile) return null

  const { error } = await admin
    .from('stripe_customers')
    .upsert({ user_id: userId, customer_id: customerId }, { onConflict: 'user_id' })
  if (error) console.error('Could not save Stripe customer mapping:', error.message)
  return userId
}

const ACTIVE_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

/** The plan a subscription entitles the customer to */
function planFromSubscription(sub: Stripe.Subscription | undefined): PlanId {
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return 'free'
  return planForPriceId(sub.items.data[0]?.price?.id)?.id ?? 'free'
}

/**
 * Mirror the customer's latest subscription into stripe_subscriptions and
 * update the user's plan. Returns the plan the user is now on.
 */
export async function syncCustomer(
  customerId: string,
  options: { resetCredits?: boolean; reason?: string; userIdHint?: string | null } = {}
): Promise<PlanId | null> {
  const stripe = requireStripe()
  const admin = createAdminClient()

  const userId = await userIdForCustomer(customerId, options.userIdHint)
  if (!userId) {
    console.warn(`Stripe customer ${customerId} has no ContentFlow user`)
    return null
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
    expand: ['data.default_payment_method'],
  })
  const sub = subscriptions.data[0]
  const item = sub?.items.data[0]
  const pm = sub?.default_payment_method
  const card = pm && typeof pm !== 'string' ? pm.card : null

  const { error: subError } = await admin.from('stripe_subscriptions').upsert(
    {
      customer_id: customerId,
      subscription_id: sub?.id ?? null,
      price_id: item?.price?.id ?? null,
      current_period_start: item?.current_period_start ?? null,
      current_period_end: item?.current_period_end ?? null,
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
      payment_method_brand: card?.brand ?? null,
      payment_method_last4: card?.last4 ?? null,
      status: sub?.status ?? 'not_started',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'customer_id' }
  )
  if (subError) throw subError

  const plan = planFromSubscription(sub)

  const { data: profile } = await admin.from('profiles').select('plan').eq('id', userId).single()

  // Apply on plan change, or on a renewal (reset to the new month's allowance).
  // When a paid subscription ends, the balance resets to the free allowance so
  // unused paid credits don't outlive the subscription.
  const ended = plan === 'free' && profile?.plan !== 'free'
  if (profile?.plan !== plan || options.resetCredits) {
    const { error } = await admin.rpc('apply_plan', {
      p_user: userId,
      p_plan: plan,
      p_reset_credits: ended || (Boolean(options.resetCredits) && plan !== 'free'),
      p_description:
        options.reason ??
        (ended ? `Subscription ended (was ${getPlan(profile?.plan).name})` : `Plan changed to ${getPlan(plan).name}`),
    })
    if (error) throw error
  }

  return plan
}

/**
 * Cancel any live subscriptions for a user (used when deleting the account).
 */
export async function cancelSubscriptionsForUser(userId: string): Promise<void> {
  const stripe = getStripe()
  if (!stripe || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!customer?.customer_id) return

  const subs = await stripe.subscriptions.list({ customer: customer.customer_id, status: 'all', limit: 10 })
  for (const sub of subs.data) {
    if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
      await stripe.subscriptions.cancel(sub.id)
    }
  }
}

/** Subscription ID referenced by an invoice (handles old and new API shapes) */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription
  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription
  const ref = fromParent ?? legacy
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}
