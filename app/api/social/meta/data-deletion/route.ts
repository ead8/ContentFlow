import { NextRequest, NextResponse } from 'next/server'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Meta "Data Deletion Request" callback (Facebook Login / App Review).
 * Register in the Meta app: App settings → Basic → Data deletion requests →
 * "Data deletion callback URL" = ${NEXT_PUBLIC_APP_URL}/api/social/meta/data-deletion
 *
 * Meta POSTs `signed_request` (form-encoded) when a person removes the app
 * from their Facebook settings and asks for their data to be deleted. The
 * signature is HMAC-SHA256 of the payload segment keyed with META_APP_SECRET.
 * We delete every Facebook / Instagram social_accounts row connected by that
 * app-scoped Facebook user (metadata.fbUserId), including the encrypted
 * tokens; published-post history is kept (post_targets.social_account_id is
 * set to NULL). Response: { url, confirmation_code } — url is the public
 * status page /data-deletion?code=...
 *
 * No session (called by Meta). Never logs the user id or the request.
 */

const META_PLATFORMS = ['Facebook', 'Instagram']
const MAX_SIGNED_REQUEST_LENGTH = 8192

function base64UrlDecode(input: string): Buffer {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64')
}

interface SignedRequestPayload {
  algorithm?: string
  user_id?: string | number
  issued_at?: number
}

/** Verify and decode a Meta signed_request; null if invalid. */
function parseSignedRequest(signedRequest: string, secret: string): SignedRequestPayload | null {
  const parts = signedRequest.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [encodedSig, encodedPayload] = parts

  const expected = createHmac('sha256', secret).update(encodedPayload).digest()
  const actual = base64UrlDecode(encodedSig)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  let payload: SignedRequestPayload
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.algorithm !== 'string' || payload.algorithm.toUpperCase() !== 'HMAC-SHA256') return null
  return payload
}

function appBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  return (configured || req.nextUrl.origin).replace(/\/+$/, '')
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.error('Meta data deletion: META_APP_SECRET is not configured')
    return error('Not configured', 503)
  }

  let signedRequest: string | null = null
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      signedRequest = typeof body?.signed_request === 'string' ? body.signed_request : null
    } else {
      const form = await req.formData()
      const value = form.get('signed_request')
      signedRequest = typeof value === 'string' ? value : null
    }
  } catch {
    signedRequest = null
  }
  if (!signedRequest || signedRequest.length > MAX_SIGNED_REQUEST_LENGTH) {
    return error('Missing signed_request', 400)
  }

  const payload = parseSignedRequest(signedRequest.trim(), secret)
  if (!payload) return error('Invalid signed_request', 400)

  const fbUserId = payload.user_id !== undefined && payload.user_id !== null ? String(payload.user_id) : ''
  if (!/^\d{1,32}$/.test(fbUserId)) return error('Invalid signed_request', 400)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    console.error('Meta data deletion: SUPABASE_SERVICE_ROLE_KEY is not configured')
    return error('Not configured', 503)
  }

  const confirmationCode = randomBytes(16).toString('hex')
  const externalUserHash = createHmac('sha256', secret).update(`meta:${fbUserId}`).digest('hex')

  const { data: request, error: insertError } = await admin
    .from('data_deletion_requests')
    .insert({
      confirmation_code: confirmationCode,
      platform: 'meta',
      external_user_hash: externalUserHash,
      status: 'pending',
    })
    .select('id')
    .single()
  if (insertError || !request) {
    console.error(`Meta data deletion: could not record request (${insertError?.code ?? 'error'})`)
    return error('Could not process the request', 500)
  }

  const { data: deleted, error: deleteError } = await admin
    .from('social_accounts')
    .delete()
    .in('platform', META_PLATFORMS)
    .eq('metadata->>fbUserId', fbUserId)
    .select('id')

  const { error: updateError } = await admin
    .from('data_deletion_requests')
    .update(
      deleteError
        ? { status: 'failed' }
        : { status: 'completed', accounts_deleted: deleted?.length ?? 0, completed_at: new Date().toISOString() }
    )
    .eq('id', request.id)

  if (deleteError) {
    console.error(`Meta data deletion: could not delete accounts (${deleteError.code ?? 'error'})`)
    return error('Could not process the request', 500)
  }
  if (updateError) {
    // Data is deleted; the status page will show "pending". Not fatal.
    console.error(`Meta data deletion: could not update request status (${updateError.code ?? 'error'})`)
  }

  return NextResponse.json({
    url: `${appBaseUrl(req)}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
