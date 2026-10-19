import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { getEncryptionKey } from './crypto'
import { appUrl, type PlatformSlug } from './types'

/**
 * OAuth `state` + PKCE verifier, kept between /connect and /callback in a
 * short-lived, HMAC-signed, httpOnly cookie scoped to /api/social/<slug>.
 * Server-only.
 */

export interface OAuthStatePayload {
  state: string
  codeVerifier: string
  slug: PlatformSlug
  userId: string
  returnTo: string
  /** Expiry, ms since epoch */
  exp: number
}

export const OAUTH_STATE_TTL_SECONDS = 10 * 60
export const DEFAULT_RETURN_TO = '/settings'

export function oauthCookieName(slug: PlatformSlug): string {
  return `cf_oauth_${slug}`
}

function cookiePath(slug: PlatformSlug): string {
  return `/api/social/${slug}`
}

/** Random, URL-safe `state` value */
export function generateState(): string {
  return randomBytes(32).toString('base64url')
}

/** PKCE code verifier: 64 base64url chars (RFC 7636 allows 43–128) */
export function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url')
}

/**
 * Restrict a user-supplied return path to this site: must start with a
 * single '/', no backslashes or control characters. Falls back to /settings.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return DEFAULT_RETURN_TO
  const v = value.trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return DEFAULT_RETURN_TO
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return DEFAULT_RETURN_TO
  if (v.length > 512) return DEFAULT_RETURN_TO
  try {
    const base = 'https://contentflow.invalid'
    const url = new URL(v, base)
    if (url.origin !== base) return DEFAULT_RETURN_TO
    // Never bounce back into the OAuth endpoints themselves
    if (url.pathname.startsWith('/api/')) return DEFAULT_RETURN_TO
    // Normalisation can turn '/..//host' into '//host' (protocol-relative)
    if (url.pathname.startsWith('//')) return DEFAULT_RETURN_TO
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_RETURN_TO
  }
}

/**
 * Absolute URL for `returnTo` with the given query params set (and any stale
 * `connected` / `count` / `connect_error` params removed).
 */
export function buildReturnUrl(
  req: NextRequest,
  returnTo: string,
  params: Record<string, string | number>
): URL {
  let origin: string
  try {
    origin = appUrl()
  } catch {
    origin = req.nextUrl.origin
  }
  const url = new URL(sanitizeReturnTo(returnTo), origin)
  url.searchParams.delete('connected')
  url.searchParams.delete('count')
  url.searchParams.delete('connect_error')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  return url
}

let cachedSigningKey: { source: Buffer; key: Buffer } | null = null

function signingKey(): Buffer {
  const source = getEncryptionKey()
  if (cachedSigningKey && cachedSigningKey.source.equals(source)) return cachedSigningKey.key
  // Derive a separate key so the encryption key is never used for HMAC directly
  const key = Buffer.from(hkdfSync('sha256', source, Buffer.alloc(0), 'contentflow-oauth-state-v1', 32))
  cachedSigningKey = { source, key }
  return key
}

function sign(data: string): string {
  return createHmac('sha256', signingKey()).update(data).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Create a new state payload for this user/platform (does not set the cookie) */
export function createOAuthState(
  slug: PlatformSlug,
  userId: string,
  returnTo?: string | null
): OAuthStatePayload {
  return {
    state: generateState(),
    codeVerifier: generateCodeVerifier(),
    slug,
    userId,
    returnTo: sanitizeReturnTo(returnTo),
    exp: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000,
  }
}

/** Serialize + sign the payload into the response cookie */
export function setOAuthStateCookie(res: NextResponse, payload: OAuthStatePayload): void {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const value = `${body}.${sign(body)}`
  res.cookies.set({
    name: oauthCookieName(payload.slug),
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath(payload.slug),
    maxAge: OAUTH_STATE_TTL_SECONDS,
  })
}

export function clearOAuthStateCookie(res: NextResponse, slug: PlatformSlug): void {
  res.cookies.set({
    name: oauthCookieName(slug),
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath(slug),
    maxAge: 0,
  })
}

/**
 * Read and verify the signed state cookie for `slug`. Returns null when it is
 * missing, tampered with, expired or for another platform. Does NOT compare
 * the `state` query param or the user — use `stateMatches` for that.
 */
export function readOAuthStateCookie(req: NextRequest, slug: PlatformSlug): OAuthStatePayload | null {
  const raw = req.cookies.get(oauthCookieName(slug))?.value
  if (!raw) return null

  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  let expected: string
  try {
    expected = sign(body)
  } catch {
    return null
  }
  if (!safeEqual(sig, expected)) return null

  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (
    !payload ||
    typeof payload.state !== 'string' ||
    typeof payload.codeVerifier !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.slug !== slug
  ) {
    return null
  }
  if (payload.exp < Date.now()) return null

  payload.returnTo = sanitizeReturnTo(payload.returnTo)
  return payload
}

/** Constant-time comparison of the `state` query param with the cookie's */
export function stateMatches(payload: OAuthStatePayload, state: string | null | undefined): boolean {
  if (!state) return false
  return safeEqual(payload.state, state)
}
