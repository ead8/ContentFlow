import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCustomer, requireStripe } from '@/lib/billing/stripe'
import { apiError } from '@/lib/api/error'
import { appUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/portal -> { url } of the Stripe customer portal
 * (change plan, update card, cancel, download invoices).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const stripe = requireStripe()
    const customerId = await getOrCreateCustomer(user.id, user.email)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl(request)}/billing`,
    })

    return NextResponse.json({ success: true, data: { url: session.url } })
  } catch (error) {
    return apiError(error, 'Error opening billing portal')
  }
}
