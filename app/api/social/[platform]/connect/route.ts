import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/error'
import { requireUserId } from '@/lib/services/auth'
import { PLATFORM_LABELS } from '@/lib/platforms'
import { isEncryptionConfigured } from '@/lib/social/crypto'
import {
  buildReturnUrl,
  createOAuthState,
  sanitizeReturnTo,
  setOAuthStateCookie,
} from '@/lib/social/oauth-state'
import { getAdapter } from '@/lib/social/registry'
import { isPlatformSlug, PLATFORM_SLUGS, redirectUriFor } from '@/lib/social/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/social/{slug}/connect?returnTo=/settings
 * Starts the OAuth flow: stores state + PKCE verifier in a signed cookie
 * and redirects to the provider's consent screen.
 */
export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const slug = params.platform
  if (!isPlatformSlug(slug)) {
    return NextResponse.json({ success: false, error: 'Unknown platform' }, { status: 404 })
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch (error) {
    return apiError(error, 'Error starting social connection')
  }

  const platform = PLATFORM_SLUGS[slug]
  const label = PLATFORM_LABELS[platform]
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const fail = (message: string) =>
    NextResponse.redirect(buildReturnUrl(request, returnTo, { connect_error: message }), 302)

  const adapter = getAdapter(platform)
  if (!adapter || !adapter.isConfigured()) {
    return fail(`${label} publishing isn't configured yet. Ask your administrator to add the ${label} app credentials.`)
  }
  if (!isEncryptionConfigured()) {
    console.error('Social connect: TOKEN_ENCRYPTION_KEY is not configured')
    return fail(`Account connections aren't configured yet (missing encryption key). Please contact support.`)
  }

  try {
    const payload = createOAuthState(slug, userId, returnTo)
    const authUrl = adapter.getAuthorizationUrl({
      state: payload.state,
      redirectUri: redirectUriFor(slug),
      codeVerifier: payload.codeVerifier,
    })
    const res = NextResponse.redirect(authUrl, 302)
    res.headers.set('Cache-Control', 'no-store')
    setOAuthStateCookie(res, payload)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error(`Social connect (${slug}) failed:`, message || 'unknown error')
    return fail(
      /not configured/.test(message)
        ? `${label} publishing isn't configured yet. Please contact support.`
        : `Couldn't start the ${label} connection. Please try again.`
    )
  }
}
