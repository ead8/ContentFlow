import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLATFORM_LABELS } from '@/lib/platforms'
import { saveConnectedAccounts } from '@/lib/social/accounts'
import {
  buildReturnUrl,
  clearOAuthStateCookie,
  DEFAULT_RETURN_TO,
  readOAuthStateCookie,
  stateMatches,
} from '@/lib/social/oauth-state'
import { getAdapter } from '@/lib/social/registry'
import {
  isPlatformSlug,
  PLATFORM_SLUGS,
  PlatformError,
  redirectUriFor,
  type PlatformSlug,
} from '@/lib/social/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Strip anything that looks like a credential and cap the length */
function redact(text: string, max = 200): string {
  return text
    .replace(/(access_token|refresh_token|client_secret|code|token)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/\b(Bearer|OAuth)\s+[A-Za-z0-9._~+/=-]+/g, '$1 [redacted]')
    .replace(/[A-Za-z0-9._~+/=-]{40,}/g, '[redacted]')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

function noAccountsMessage(slug: PlatformSlug, label: string): string {
  switch (slug) {
    case 'facebook':
      return 'No Facebook Pages found. ContentFlow publishes to Pages you manage — make sure you have a Page and selected it when granting access, then try again.'
    case 'instagram':
      return 'No Instagram professional accounts found. Switch your Instagram account to Business or Creator, link it to a Facebook Page, select both when granting access, then try again.'
    case 'youtube':
      return 'No YouTube channel found for this Google account. Create a channel (or choose the account that owns it), then try again.'
    default:
      return `No ${label} accounts were returned. Make sure you approved all requested permissions, then try again.`
  }
}

/**
 * GET /api/social/{slug}/callback?code=&state=
 * Completes the OAuth flow and stores the connected accounts, then redirects
 * to `{returnTo}?connected={slug}&count=N` or `{returnTo}?connect_error=...`.
 */
export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const slug = params.platform
  if (!isPlatformSlug(slug)) {
    return NextResponse.json({ success: false, error: 'Unknown platform' }, { status: 404 })
  }

  const platform = PLATFORM_SLUGS[slug]
  const label = PLATFORM_LABELS[platform]
  const search = request.nextUrl.searchParams
  const payload = readOAuthStateCookie(request, slug)
  const returnTo = payload?.returnTo ?? DEFAULT_RETURN_TO

  const finish = (query: Record<string, string | number>) => {
    const res = NextResponse.redirect(buildReturnUrl(request, returnTo, query), 302)
    res.headers.set('Cache-Control', 'no-store')
    clearOAuthStateCookie(res, slug)
    return res
  }
  const fail = (message: string) => finish({ connect_error: message })

  // The user declined or the provider reported a problem
  const validState = !!payload && stateMatches(payload, search.get('state'))
  const providerError = search.get('error')
  if (providerError) {
    if (/access_denied|user_cancel|cancel/i.test(providerError)) {
      return fail(`${label} connection was cancelled.`)
    }
    console.warn(`Social callback (${slug}) provider error:`, redact(providerError, 100))
    // Only echo the provider's description for a request we started, so a
    // crafted link can't put arbitrary text into the settings page.
    const description = validState
      ? redact(search.get('error_description') || search.get('error_reason') || providerError)
      : ''
    return fail(
      description
        ? `${label} returned an error: ${description}. Please try again.`
        : `${label} returned an error. Please try again.`
    )
  }

  if (!payload || !validState) {
    return fail(`Your ${label} connection request expired or was invalid. Please try connecting again.`)
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return fail(`Your session expired. Please sign in and connect ${label} again.`)
  }
  if (user.id !== payload.userId) {
    return fail(`This ${label} connection was started by a different user. Please try connecting again.`)
  }

  const code = search.get('code')
  if (!code) {
    return fail(`${label} did not return an authorization code. Please try again.`)
  }

  const adapter = getAdapter(platform)
  if (!adapter || !adapter.isConfigured()) {
    return fail(`${label} publishing isn't configured yet.`)
  }

  try {
    const tokens = await adapter.exchangeCode({
      code,
      redirectUri: redirectUriFor(slug),
      codeVerifier: payload.codeVerifier,
    })
    const accounts = await adapter.fetchAccounts(tokens)
    if (accounts.length === 0) {
      return fail(noAccountsMessage(slug, label))
    }

    const count = await saveConnectedAccounts(user.id, platform, accounts, tokens)
    return finish({ connected: slug, count })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error(`Social callback (${slug}) failed:`, redact(message || 'unknown error', 300))

    // Adapters throw user-readable PlatformErrors (e.g. Meta: "No Facebook
    // Pages found…" / permissions declined) — show them as-is, redacted.
    if (error instanceof PlatformError) {
      return fail(redact(message, 400) || `Couldn't connect ${label}. Please try again.`)
    }
    if (/not configured/.test(message)) {
      return fail(`${label} publishing isn't fully configured yet. Please contact support.`)
    }
    return fail(`Couldn't connect ${label}. Please try again.`)
  }
}
