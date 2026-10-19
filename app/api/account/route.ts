import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DELETE /api/account  { "confirm": "DELETE" }
 *
 * Permanently deletes the signed-in user's account:
 *   1. cancels their Stripe subscriptions immediately (needs STRIPE_SECRET_KEY
 *      in the Next.js env whenever the user has a Stripe customer; otherwise
 *      the request is refused so nobody keeps getting billed for a deleted
 *      account) and unlinks the Stripe customer from the user id,
 *   2. deletes their files in the `media` storage bucket (<user_id>/...),
 *   3. deletes the local Stripe mirror rows and the auth user, which cascades
 *      to every user-owned row (profile, posts, social accounts and their
 *      encrypted tokens, notifications, ...),
 *   4. clears the session cookies.
 *
 * Nothing user-identifying or secret is logged.
 */

const MEDIA_BUCKET = 'media'
const LIST_PAGE_SIZE = 1000
const REMOVE_BATCH_SIZE = 500
const MAX_FOLDER_DEPTH = 12

/** Subscription states that can no longer bill the customer */
const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired'])

class AccountDeletionError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = 'AccountDeletionError'
  }
}

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error: message, ...(code ? { code } : {}) }, { status })
}

function stripeSecret(): string | undefined {
  return process.env.STRIPE_SECRET_KEY || process.env.NEXT_PRIVATE_STRIPE_SECRET_KEY || undefined
}

function isStripeMissing(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeError && err.code === 'resource_missing'
}

/** Cancel every subscription of the customer that could still bill, and unlink it from the user. */
async function cancelStripeBilling(customerId: string): Promise<void> {
  const secret = stripeSecret()
  if (!secret) {
    throw new AccountDeletionError(
      'Your account has billing attached, and billing is not configured on the server, so we cannot cancel your subscription. Please contact support to delete your account.',
      503,
      'billing_not_configured'
    )
  }

  const stripe = new Stripe(secret, { appInfo: { name: 'ContentFlow', version: '1.0.0' } })

  try {
    const subscriptions = await stripe.subscriptions
      .list({ customer: customerId, status: 'all', limit: 100 })
      .autoPagingToArray({ limit: 1000 })

    for (const sub of subscriptions) {
      if (TERMINAL_SUBSCRIPTION_STATUSES.has(sub.status)) continue
      try {
        await stripe.subscriptions.cancel(sub.id)
      } catch (err) {
        if (!isStripeMissing(err)) throw err
      }
    }

    // The customer (and its invoices) stays in Stripe for accounting, but no
    // longer points at the deleted user, so the stripe-webhook ignores the
    // follow-up subscription events instead of trying to re-link it.
    await stripe.customers.update(customerId, {
      metadata: { userId: '', user_id: '', account_deleted_at: new Date().toISOString() },
    })
  } catch (err) {
    if (isStripeMissing(err)) return // customer already deleted in Stripe: nothing can bill
    const kind = err instanceof Stripe.errors.StripeError ? `${err.type}${err.code ? `/${err.code}` : ''}` : 'unknown'
    console.error(`Account deletion: Stripe cancellation failed (${kind})`)
    throw new AccountDeletionError(
      'We could not cancel your subscription, so your account was not deleted. Please try again or contact support.',
      502,
      'billing_cancel_failed'
    )
  }
}

/** All object paths under `prefix` in the media bucket (storage list is per folder, so recurse). */
async function listMediaPaths(admin: SupabaseClient, prefix: string, depth = 0): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) return []
  const paths: string[] = []

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    const entries = data ?? []

    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`
      // Folders are returned as entries without an id
      if (entry.id === null || entry.id === undefined) {
        paths.push(...(await listMediaPaths(admin, path, depth + 1)))
      } else {
        paths.push(path)
      }
    }

    if (entries.length < LIST_PAGE_SIZE) break
  }

  return paths
}

async function deleteMedia(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const paths = await listMediaPaths(admin, userId)
    for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
      const { error } = await admin.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + REMOVE_BATCH_SIZE))
      if (error) throw error
    }
  } catch (err) {
    console.error('Account deletion: media cleanup failed', err instanceof Error ? err.message : 'unknown error')
    throw new AccountDeletionError(
      'We could not delete your media files. Your account was not deleted; please try again.',
      500,
      'media_delete_failed'
    )
  }
}

/** Stripe mirror rows are keyed by customer_id and do not cascade from auth.users. */
async function deleteStripeMirror(admin: SupabaseClient, customerId: string): Promise<void> {
  for (const table of ['stripe_subscriptions', 'stripe_orders']) {
    const { error } = await admin.from(table).delete().eq('customer_id', customerId)
    if (error) console.error(`Account deletion: could not remove ${table} rows (${error.code ?? 'error'})`)
  }
}

/** Names of the Supabase auth cookies (sb-<ref>-auth-token, possibly chunked). */
function authCookieNames(): string[] {
  return cookies()
    .getAll()
    .map((c) => c.name)
    .filter((name) => /^sb-.*-auth-token(\.\d+)?$/.test(name))
}

export async function DELETE(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('User not authenticated', 401)

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }
  if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== 'DELETE') {
    return fail('Type DELETE to confirm account deletion.', 400, 'confirmation_required')
  }

  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch {
    console.error('Account deletion: SUPABASE_SERVICE_ROLE_KEY is not configured')
    return fail('Account deletion is not available right now. Please contact support.', 503, 'not_configured')
  }

  try {
    // 1. Billing
    const { data: customer, error: customerError } = await admin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (customerError) {
      console.error(`Account deletion: billing lookup failed (${customerError.code ?? 'error'})`)
      return fail('Something went wrong. Please try again.', 500)
    }
    const customerId: string | null = customer?.customer_id ?? null
    if (customerId) await cancelStripeBilling(customerId)

    // 2. Storage
    await deleteMedia(admin, user.id)

    // 3. Database rows + auth user
    if (customerId) await deleteStripeMirror(admin, customerId)

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error(`Account deletion: auth user delete failed (${deleteError.status ?? 'error'})`)
      return fail('We could not delete your account. Please try again or contact support.', 500, 'delete_failed')
    }
  } catch (err) {
    if (err instanceof AccountDeletionError) return fail(err.message, err.status, err.code)
    console.error('Account deletion failed', err instanceof Error ? err.name : 'unknown error')
    return fail('Something went wrong. Please try again.', 500)
  }

  // 4. Session. The user no longer exists, so the logout call may fail;
  // the cookies are cleared either way.
  const sessionCookies = authCookieNames()
  await supabase.auth.signOut().catch(() => {})
  const response = NextResponse.json({ success: true, data: { deleted: true } })
  for (const name of sessionCookies) response.cookies.set(name, '', { path: '/', maxAge: 0 })
  return response
}
