import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlan, priceIdForPlan } from '@/lib/billing/plans'
import { getOrCreateCustomer, requireStripe } from '@/lib/billing/stripe'
import { apiError, ValidationError } from '@/lib/api/error'
import { appUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/checkout  Body: { plan: 'creator' | 'growth' | 'agency' | 'enterprise' }
 * -> { url } of a Stripe Checkout session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { plan: planId } = await request.json().catch(() => ({}))
    const plan = getPlan(planId)
    const priceId = priceIdForPlan(plan)
    if (plan.id !== planId || !priceId) throw new ValidationError('That plan is not available')

    const stripe = requireStripe()
    const customerId = await getOrCreateCustomer(user.id, user.email)

    // Existing subscribers change plans in the billing portal instead
    const existing = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
    if (existing.data.length > 0) {
      throw new ValidationError('You already have a subscription. Use Manage billing to change plans.')
    }

    const base = appUrl(request)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id, plan: plan.id } },
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/billing?checkout=cancelled`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return NextResponse.json({ success: true, data: { url: session.url } })
  } catch (error) {
    return apiError(error, 'Error starting checkout')
  }
}
