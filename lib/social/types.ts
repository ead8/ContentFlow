import type { Platform } from '@/lib/platforms'

/**
 * Shared contract between the OAuth flow, the platform adapters and the
 * background publisher. Server-only.
 */

/** URL-safe slug used in /api/social/[slug]/connect and /callback */
export type PlatformSlug = 'linkedin' | 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube'

export const PLATFORM_SLUGS: Record<PlatformSlug, Platform> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X-Twitter',
  tiktok: 'Tiktok',
  youtube: 'YouTube_Shorts',
}

export function slugForPlatform(platform: Platform): PlatformSlug {
  return (Object.keys(PLATFORM_SLUGS) as PlatformSlug[]).find((s) => PLATFORM_SLUGS[s] === platform)!
}

export function isPlatformSlug(s: string): s is PlatformSlug {
  return Object.prototype.hasOwnProperty.call(PLATFORM_SLUGS, s)
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string | null
  /** When the access token expires; null/undefined if it does not */
  expiresAt?: Date | null
  refreshTokenExpiresAt?: Date | null
  scopes?: string[]
}

/** An account the user can publish to, as returned by the provider */
export interface ConnectedAccountInfo {
  /** Provider's id for the account/page/channel */
  accountId: string
  accountName: string
  /** e.g. 'profile', 'organization', 'page', 'instagram_business', 'channel' */
  accountType: string
  avatarUrl?: string | null
  /** Provider-specific data the adapter needs later (e.g. LinkedIn author URN) */
  metadata?: Record<string, unknown>
  /**
   * Tokens to store for this account. Defaults to the user-level tokens from
   * exchangeCode; Facebook pages / Instagram accounts use a page token here.
   */
  tokens?: OAuthTokens
}

/** A connected account with decrypted tokens, as loaded from social_accounts */
export interface SocialAccount {
  id: string
  userId: string
  platform: Platform
  accountId: string
  accountName: string
  accountType: string
  metadata: Record<string, unknown>
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: Date | null
}

export interface PublishRequest {
  account: SocialAccount
  /** Final text for this platform (post + CTA + hashtags) */
  text: string
  /** Public https URLs of images/videos, in order */
  mediaUrls: string[]
  /** Title where the platform has one (YouTube) */
  title?: string | null
  /**
   * Adapters call this immediately before sending the request that creates
   * the post. Any failure after it is ambiguous (the post may exist), so the
   * publisher never retries it automatically, which would double-post.
   */
  commit?: () => void
}

export interface PublishResult {
  /** Provider's id for the created post; used to fetch metrics later */
  externalId: string
  /** Public URL of the live post, if known */
  url: string | null
}

/** Current totals for one published post; omit metrics the platform lacks */
export interface PostMetricsResult {
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  clicks?: number
}

export interface AccountMetricsResult {
  followers?: number
}

export interface AuthorizationParams {
  state: string
  redirectUri: string
  /** PKCE verifier; adapters that use PKCE derive the S256 challenge from it */
  codeVerifier: string
}

export interface ExchangeParams {
  code: string
  redirectUri: string
  codeVerifier: string
}

export interface PlatformAdapter {
  platform: Platform
  /** Human-readable reason when the platform cannot publish this post */
  validate?(req: Omit<PublishRequest, 'account'>): string | null
  /** True when the app's client id/secret env vars are set */
  isConfigured(): boolean
  getAuthorizationUrl(params: AuthorizationParams): string
  exchangeCode(params: ExchangeParams): Promise<OAuthTokens>
  /** Accounts the user can publish to with these tokens (may be several) */
  fetchAccounts(tokens: OAuthTokens): Promise<ConnectedAccountInfo[]>
  /** Omit when tokens are long-lived and cannot be refreshed */
  refreshTokens?(refreshToken: string): Promise<OAuthTokens>
  publish(req: PublishRequest): Promise<PublishResult>
  fetchPostMetrics?(account: SocialAccount, externalId: string): Promise<PostMetricsResult>
  fetchAccountMetrics?(account: SocialAccount): Promise<AccountMetricsResult>
}

/**
 * Error from a platform API. The publisher retries `retryable` errors with
 * backoff, and marks the account expired when `reauthRequired` is set.
 * `message` is shown to the user, so keep it human-readable.
 */
export class PlatformError extends Error {
  name = 'PlatformError'
  readonly retryable: boolean
  readonly reauthRequired: boolean
  readonly status?: number

  constructor(
    message: string,
    opts: { retryable?: boolean; reauthRequired?: boolean; status?: number } = {}
  ) {
    super(message)
    this.retryable = opts.retryable ?? false
    this.reauthRequired = opts.reauthRequired ?? false
    this.status = opts.status
  }
}

/**
 * Turn a failed fetch Response into a PlatformError: 401 → reauth,
 * 429/5xx → retryable, anything else → permanent.
 */
export async function platformErrorFromResponse(
  res: Response,
  label: string
): Promise<PlatformError> {
  let detail = ''
  try {
    const text = await res.text()
    try {
      const body = JSON.parse(text)
      detail =
        body?.error?.message ||
        body?.error_description ||
        body?.message ||
        body?.detail ||
        body?.errors?.[0]?.message ||
        (typeof body?.error === 'string' ? body.error : '') ||
        text
    } catch {
      detail = text
    }
  } catch {
    // ignore
  }
  detail = String(detail).slice(0, 300)
  const message = `${label} failed (${res.status})${detail ? `: ${detail}` : ''}`

  if (res.status === 401) {
    return new PlatformError(message, { reauthRequired: true, status: res.status })
  }
  return new PlatformError(message, {
    retryable: res.status === 429 || res.status >= 500,
    status: res.status,
  })
}

/** Base URL of the app, used for OAuth redirect URIs */
export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  return url.replace(/\/+$/, '')
}

export function redirectUriFor(slug: PlatformSlug): string {
  return `${appUrl()}/api/social/${slug}/callback`
}
