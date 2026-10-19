import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { invoiceSubscriptionId, requireStripe, syncCustomer } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function customerId(obj: { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }) {
  const c = obj.customer
  if (!c) return null
  return typeof c === 'string' ? c : c.id
}

/**
 * Stripe webhook. Configure the endpoint in Stripe for:
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted, invoice.paid
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = requireStripe()
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Exactly-once: record the event id first; a redelivered or concurrent
  // delivery hits the primary key and is skipped.
  const admin = createAdminClient()
  const { error: claimError } = await admin
    .from('processed_stripe_events')
    .insert({ id: event.id, type: event.type })
  if (claimError) {
    if (claimError.code === '23505') return NextResponse.json({ received: true, duplicate: true })
    console.error('Could not record Stripe event:', claimError.message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const id = customerId(session)
        if (id && session.mode === 'subscription') {
          await syncCustomer(id, { userIdHint: session.client_reference_id })
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const id = customerId(event.data.object)
        if (id) await syncCustomer(id)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object
        const id = customerId(invoice)
        // Monthly renewals reset the balance to the plan's allowance
        if (id && invoiceSubscriptionId(invoice)) {
          const renewal = invoice.billing_reason === 'subscription_cycle'
          await syncCustomer(id, {
            resetCredits: renewal,
            reason: renewal ? 'Monthly plan credits' : undefined,
          })
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type} (${event.id}):`, err)
    // Forget the event so Stripe's retry is processed; a 500 triggers the retry
    await admin.from('processed_stripe_events').delete().eq('id', event.id)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
