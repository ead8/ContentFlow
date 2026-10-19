import {
  PlatformError,
  platformErrorFromResponse,
  type AccountMetricsResult,
  type ConnectedAccountInfo,
  type OAuthTokens,
  type PlatformAdapter,
  type PostMetricsResult,
  type PublishRequest,
  type PublishResult,
  type SocialAccount,
} from '../types'

/**
 * LinkedIn adapter (server-only).
 *
 * - Auth: OAuth 2.0 3-legged authorization code flow (confidential web app,
 *   client secret at the token endpoint; LinkedIn's PKCE is only for native
 *   apps, so the code verifier is ignored here).
 * - Publishing: versioned Posts API (`/rest/posts`) with the Images and
 *   Videos APIs for media.
 * - Personal posting needs the "Share on LinkedIn" + "Sign In with LinkedIn
 *   using OpenID Connect" products. Company pages need the Community
 *   Management API product (separate approval) — opt in with
 *   LINKEDIN_ORG_SCOPES=true.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 */

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const REST = 'https://api.linkedin.com/rest'

/** Marketing API version (YYYYMM). Each version is supported for >= 1 year. */
const DEFAULT_API_VERSION = '202610'

const MEMBER_SCOPES = ['openid', 'profile', 'email', 'w_member_social']
const ORG_SCOPES = ['r_organization_admin', 'w_organization_social']

const MAX_CHARS = 3000
const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 36 * 1024 * 1024 // generous; LinkedIn limits by pixel count
const MAX_VIDEO_BYTES = 500 * 1024 * 1024
const VIDEO_POLL_TIMEOUT_MS = 60_000
const VIDEO_POLL_INTERVAL_MS = 3_000

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function clientId(): string {
  const v = process.env.LINKEDIN_CLIENT_ID
  if (!v) throw new PlatformError('LinkedIn is not configured (LINKEDIN_CLIENT_ID is missing)')
  return v
}

function clientSecret(): string {
  const v = process.env.LINKEDIN_CLIENT_SECRET
  if (!v) throw new PlatformError('LinkedIn is not configured (LINKEDIN_CLIENT_SECRET is missing)')
  return v
}

function orgScopesEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.LINKEDIN_ORG_SCOPES?.trim() ?? '')
}

function apiVersion(): string {
  const v = process.env.LINKEDIN_API_VERSION?.trim()
  return v && /^\d{6}(\.\d{2})?$/.test(v) ? v : DEFAULT_API_VERSION
}

function requestedScopes(): string[] {
  return orgScopesEnabled() ? [...MEMBER_SCOPES, ...ORG_SCOPES] : MEMBER_SCOPES
}

function restHeaders(accessToken: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': apiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Network failures (DNS, reset, timeout) are worth retrying */
async function safeFetch(url: string, init: RequestInit, label: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new PlatformError(`${label} failed: network error (${msg})`, { retryable: true })
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

interface LinkedInTokenResponse {
  access_token: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
  id_token?: string
}

function parseTokens(body: LinkedInTokenResponse): OAuthTokens {
  const now = Date.now()
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(now + body.expires_in * 1000) : null,
    refreshTokenExpiresAt: body.refresh_token_expires_in
      ? new Date(now + body.refresh_token_expires_in * 1000)
      : null,
    // LinkedIn returns scopes comma-separated; accept spaces too
    scopes: body.scope ? body.scope.split(/[\s,]+/).filter(Boolean) : undefined,
  }
}

async function tokenRequest(params: Record<string, string>, label: string): Promise<OAuthTokens> {
  const res = await safeFetch(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
      cache: 'no-store',
    },
    label
  )
  if (!res.ok) {
    const err = await platformErrorFromResponse(res, label)
    // 400 invalid_grant / invalid_request on the token endpoint means the
    // code or refresh token is unusable — the user must reconnect.
    if (res.status === 400 || res.status === 401) {
      throw new PlatformError(err.message, { reauthRequired: true, status: res.status })
    }
    throw err
  }
  const body = (await res.json()) as LinkedInTokenResponse
  if (!body.access_token) {
    throw new PlatformError(`${label} failed: LinkedIn did not return an access token`)
  }
  return parseTokens(body)
}

// ---------------------------------------------------------------------------
// little text format
// ---------------------------------------------------------------------------

/** Characters reserved by LinkedIn's "little" text format */
const LITTLE_RESERVED = new Set(['\\', '|', '{', '}', '@', '[', ']', '(', ')', '<', '>', '#', '*', '_', '~'])

function escapeLittleChars(s: string): string {
  let out = ''
  for (const ch of Array.from(s)) {
    out += LITTLE_RESERVED.has(ch) ? `\\${ch}` : ch
  }
  return out
}

// Built with the RegExp constructor so the `u` flag is allowed with an ES5 TS target
const HASHTAG_BODY = new RegExp('^[\\p{L}\\p{M}\\p{N}_]+', 'u')
const WORD_CHAR = new RegExp('[\\p{L}\\p{M}\\p{N}_]', 'u')

/**
 * Convert plain text into LinkedIn "little" commentary: every reserved
 * character is backslash-escaped, and `#tag` (at a word boundary) becomes a
 * HashtagTemplate `{hashtag|\#|tag}` so it renders as a real hashtag.
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 */
export function toLittleText(text: string): string {
  const chars = Array.from(text)
  let out = ''
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (ch === '#' || ch === '＃') {
      const prev = i > 0 ? chars[i - 1] : ''
      const rest = chars.slice(i + 1).join('')
      const m = HASHTAG_BODY.exec(rest)
      if (m && (!prev || !WORD_CHAR.test(prev))) {
        const tag = m[0]
        const sign = ch === '#' ? '\\#' : ch
        out += `{hashtag|${sign}|${escapeLittleChars(tag)}}`
        i += 1 + Array.from(tag).length
        continue
      }
    }
    out += LITTLE_RESERVED.has(ch) ? `\\${ch}` : ch
    i++
  }
  return out
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i

function isVideoUrl(url: string): boolean {
  try {
    return VIDEO_EXT.test(new URL(url).pathname)
  } catch {
    return VIDEO_EXT.test(url.split('?')[0])
  }
}

interface DownloadedMedia {
  data: ArrayBuffer
  contentType: string
  isVideo: boolean
}

async function downloadMedia(url: string, maxBytes: number): Promise<DownloadedMedia> {
  const res = await safeFetch(url, { cache: 'no-store' }, 'Downloading media for LinkedIn')
  if (!res.ok) {
    throw new PlatformError(`Could not download a media file for LinkedIn (HTTP ${res.status})`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
    })
  }
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared && declared > maxBytes) {
    throw new PlatformError(
      `A media file is too large for LinkedIn (${Math.round(declared / 1024 / 1024)} MB; max ${Math.round(maxBytes / 1024 / 1024)} MB)`
    )
  }
  const data = await res.arrayBuffer()
  if (data.byteLength > maxBytes) {
    throw new PlatformError(
      `A media file is too large for LinkedIn (${Math.round(data.byteLength / 1024 / 1024)} MB; max ${Math.round(maxBytes / 1024 / 1024)} MB)`
    )
  }
  if (data.byteLength === 0) throw new PlatformError('A media file for LinkedIn is empty')
  return { data, contentType, isVideo: contentType.startsWith('video/') || isVideoUrl(url) }
}

async function uploadImage(accessToken: string, owner: string, media: DownloadedMedia): Promise<string> {
  if (media.isVideo) {
    throw new PlatformError('LinkedIn posts can contain several images or one video, not both')
  }

  const init = await safeFetch(
    `${REST}/images?action=initializeUpload`,
    {
      method: 'POST',
      headers: restHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
      cache: 'no-store',
    },
    'LinkedIn image upload'
  )
  if (!init.ok) throw await platformErrorFromResponse(init, 'LinkedIn image upload')
  const { value } = (await init.json()) as { value?: { uploadUrl?: string; image?: string } }
  if (!value?.uploadUrl || !value.image) {
    throw new PlatformError('LinkedIn image upload failed: no upload URL returned', { retryable: true })
  }

  const put = await safeFetch(
    value.uploadUrl,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': media.contentType || 'application/octet-stream',
      },
      body: media.data,
      cache: 'no-store',
    },
    'LinkedIn image upload'
  )
  if (!put.ok) throw await platformErrorFromResponse(put, 'LinkedIn image upload')
  return value.image
}

interface VideoInitResponse {
  value?: {
    video?: string
    uploadToken?: string
    uploadInstructions?: { uploadUrl: string; firstByte: number; lastByte: number }[]
  }
}

async function uploadVideo(accessToken: string, owner: string, media: DownloadedMedia): Promise<string> {
  if (media.data.byteLength < 75 * 1024) {
    throw new PlatformError('This video is too small for LinkedIn (minimum 75 KB)')
  }

  const init = await safeFetch(
    `${REST}/videos?action=initializeUpload`,
    {
      method: 'POST',
      headers: restHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner,
          fileSizeBytes: media.data.byteLength,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
      cache: 'no-store',
    },
    'LinkedIn video upload'
  )
  if (!init.ok) throw await platformErrorFromResponse(init, 'LinkedIn video upload')
  const { value } = (await init.json()) as VideoInitResponse
  const video = value?.video
  const instructions = value?.uploadInstructions ?? []
  if (!video || instructions.length === 0) {
    throw new PlatformError('LinkedIn video upload failed: no upload instructions returned', {
      retryable: true,
    })
  }

  // Upload each part in order and collect the ETags
  const partIds: string[] = []
  const sorted = [...instructions].sort((a, b) => a.firstByte - b.firstByte)
  for (const part of sorted) {
    const chunk = media.data.slice(part.firstByte, part.lastByte + 1)
    const res = await safeFetch(
      part.uploadUrl,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
        cache: 'no-store',
      },
      'LinkedIn video upload'
    )
    if (!res.ok) throw await platformErrorFromResponse(res, 'LinkedIn video upload')
    const etag = res.headers.get('etag')
    if (!etag) {
      throw new PlatformError('LinkedIn video upload failed: missing part id (ETag)', { retryable: true })
    }
    partIds.push(etag.replace(/^W\//, '').replace(/^"|"$/g, ''))
  }

  const fin = await safeFetch(
    `${REST}/videos?action=finalizeUpload`,
    {
      method: 'POST',
      headers: restHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        finalizeUploadRequest: {
          video,
          uploadToken: value?.uploadToken ?? '',
          uploadedPartIds: partIds,
        },
      }),
      cache: 'no-store',
    },
    'LinkedIn video upload'
  )
  if (!fin.ok) throw await platformErrorFromResponse(fin, 'LinkedIn video upload')

  await waitForVideo(accessToken, video)
  return video
}

/**
 * Poll the video until LinkedIn has processed it. If it is still processing
 * when the timeout hits (or the status can't be read), we post anyway —
 * LinkedIn publishes the post once processing finishes.
 */
async function waitForVideo(accessToken: string, video: string): Promise<void> {
  const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(VIDEO_POLL_INTERVAL_MS)
    let res: Response
    try {
      res = await fetch(`${REST}/videos/${encodeURIComponent(video)}`, {
        headers: restHeaders(accessToken),
        cache: 'no-store',
      })
    } catch {
      continue
    }
    if (res.status === 401) throw await platformErrorFromResponse(res, 'LinkedIn video status')
    if (!res.ok) return // e.g. 403 without read permission — don't block the post
    const body = (await res.json()) as { status?: string; processingFailureReason?: string }
    if (body.status === 'AVAILABLE') return
    if (body.status === 'PROCESSING_FAILED') {
      throw new PlatformError(
        `LinkedIn could not process the video${body.processingFailureReason ? `: ${body.processingFailureReason}` : ''}`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------

function authorUrnFor(account: SocialAccount): string {
  const fromMeta = account.metadata?.authorUrn
  if (typeof fromMeta === 'string' && fromMeta.startsWith('urn:li:')) return fromMeta
  return account.accountType === 'organization'
    ? `urn:li:organization:${account.accountId}`
    : `urn:li:person:${account.accountId}`
}

interface LinkedInOrganization {
  id?: number
  localizedName?: string
  vanityName?: string
  logoV2?: { original?: string; cropped?: string }
}

async function fetchAdministeredOrganizations(accessToken: string): Promise<ConnectedAccountInfo[]> {
  const orgUrns = new Set<string>()
  let start = 0
  const count = 100
  for (let page = 0; page < 10; page++) {
    const res = await safeFetch(
      `${REST}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&start=${start}&count=${count}`,
      { headers: restHeaders(accessToken), cache: 'no-store' },
      'LinkedIn organizations lookup'
    )
    if (res.status === 401) throw await platformErrorFromResponse(res, 'LinkedIn organizations lookup')
    // 403: the app lacks the Community Management API product — personal only
    if (!res.ok) return []
    const body = (await res.json()) as {
      elements?: { organization?: string; organizationTarget?: string }[]
    }
    const elements = body.elements ?? []
    for (const el of elements) {
      const urn = el.organization || el.organizationTarget
      if (urn && urn.startsWith('urn:li:organization:')) orgUrns.add(urn)
    }
    if (elements.length < count) break
    start += count
  }

  const accounts: ConnectedAccountInfo[] = []
  for (const urn of Array.from(orgUrns)) {
    const id = urn.slice('urn:li:organization:'.length)
    let org: LinkedInOrganization = {}
    try {
      const res = await fetch(`${REST}/organizations/${encodeURIComponent(id)}`, {
        headers: restHeaders(accessToken),
        cache: 'no-store',
      })
      if (res.ok) org = (await res.json()) as LinkedInOrganization
    } catch {
      // name lookup is best-effort
    }
    accounts.push({
      accountId: id,
      accountName: org.localizedName || org.vanityName || `LinkedIn page ${id}`,
      accountType: 'organization',
      // logoV2 holds digital media URNs, not URLs, so there's no direct avatar
      avatarUrl: null,
      metadata: {
        authorUrn: urn,
        vanityName: org.vanityName ?? null,
        logoUrn: org.logoV2?.cropped ?? org.logoV2?.original ?? null,
      },
    })
  }
  return accounts
}

function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const linkedinAdapter: PlatformAdapter = {
  platform: 'LinkedIn',

  isConfigured() {
    return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
  },

  validate({ text, mediaUrls }) {
    const length = Array.from(text ?? '').length
    if (length > MAX_CHARS) {
      return `LinkedIn posts can be at most ${MAX_CHARS} characters (this one has ${length})`
    }
    if (!text?.trim() && mediaUrls.length === 0) return 'LinkedIn posts need text or media'
    const videos = mediaUrls.filter(isVideoUrl)
    if (videos.length > 1) return 'LinkedIn posts can include only one video'
    if (videos.length === 1 && mediaUrls.length > 1) {
      return 'LinkedIn posts can include several images or one video, not both'
    }
    if (mediaUrls.length > MAX_IMAGES) return `LinkedIn posts can include at most ${MAX_IMAGES} images`
    return null
  },

  getAuthorizationUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      redirect_uri: redirectUri,
      state,
      scope: requestedScopes().join(' '),
    })
    return `${AUTH_URL}?${params.toString().replace(/\+/g, '%20')}`
  },

  async exchangeCode({ code, redirectUri }) {
    return tokenRequest(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId(),
        client_secret: clientSecret(),
      },
      'LinkedIn sign-in'
    )
  },

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new PlatformError('LinkedIn session expired — please reconnect your LinkedIn account', {
        reauthRequired: true,
      })
    }
    const tokens = await tokenRequest(
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId(),
        client_secret: clientSecret(),
      },
      'LinkedIn token refresh'
    )
    // LinkedIn usually returns the same refresh token; keep the old one if omitted
    return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken }
  },

  async fetchAccounts(tokens) {
    const res = await safeFetch(
      USERINFO_URL,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` }, cache: 'no-store' },
      'LinkedIn profile lookup'
    )
    if (!res.ok) throw await platformErrorFromResponse(res, 'LinkedIn profile lookup')
    const me = (await res.json()) as {
      sub?: string
      name?: string
      given_name?: string
      family_name?: string
      picture?: string
      email?: string
    }
    if (!me.sub) throw new PlatformError('LinkedIn did not return a member id')

    const accounts: ConnectedAccountInfo[] = [
      {
        accountId: me.sub,
        accountName:
          me.name || [me.given_name, me.family_name].filter(Boolean).join(' ') || 'LinkedIn member',
        accountType: 'profile',
        avatarUrl: me.picture ?? null,
        metadata: { authorUrn: `urn:li:person:${me.sub}`, email: me.email ?? null },
      },
    ]

    const granted = tokens.scopes ?? []
    const hasOrgScope = granted.length
      ? granted.includes('w_organization_social')
      : orgScopesEnabled()
    if (orgScopesEnabled() && hasOrgScope) {
      accounts.push(...(await fetchAdministeredOrganizations(tokens.accessToken)))
    }
    return accounts
  },

  async publish(req: PublishRequest): Promise<PublishResult> {
    const problem = linkedinAdapter.validate?.(req)
    if (problem) throw new PlatformError(problem)

    const { account } = req
    const author = authorUrnFor(account)
    const token = account.accessToken

    const body: Record<string, unknown> = {
      author,
      commentary: toLittleText(req.text ?? ''),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    const urls = req.mediaUrls ?? []
    if (urls.length === 1) {
      // Single file: decide image vs video from the extension or Content-Type
      const media = await downloadMedia(urls[0], MAX_VIDEO_BYTES)
      if (media.isVideo) {
        const video = await uploadVideo(token, author, media)
        body.content = {
          media: { id: video, ...(req.title ? { title: req.title.slice(0, 200) } : {}) },
        }
      } else {
        if (media.data.byteLength > MAX_IMAGE_BYTES) {
          throw new PlatformError('This image is too large for LinkedIn')
        }
        body.content = { media: { id: await uploadImage(token, author, media) } }
      }
    } else if (urls.length > 1) {
      const images: { id: string }[] = []
      for (const url of urls) {
        const media = await downloadMedia(url, MAX_IMAGE_BYTES)
        images.push({ id: await uploadImage(token, author, media) })
      }
      body.content = { multiImage: { images } }
    }

    const res = await safeFetch(
      `${REST}/posts`,
      {
        method: 'POST',
        headers: restHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      'LinkedIn publish'
    )
    if (!res.ok) {
      const err = await platformErrorFromResponse(res, 'LinkedIn publish')
      if (res.status === 403) {
        throw new PlatformError(
          account.accountType === 'organization'
            ? `${err.message}. Make sure you are an admin of this LinkedIn page and the app has Community Management API access.`
            : `${err.message}. Please reconnect LinkedIn and allow posting permissions.`,
          { status: 403 }
        )
      }
      throw err
    }

    let urn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || ''
    if (!urn) {
      try {
        const json = (await res.json()) as { id?: string }
        urn = json.id ?? ''
      } catch {
        // 201 with empty body
      }
    }
    if (!urn) {
      // The post was created, so don't make it retryable (would double-post)
      throw new PlatformError('LinkedIn accepted the post but did not return its id')
    }
    try {
      urn = decodeURIComponent(urn)
    } catch {
      // keep as-is
    }
    return { externalId: urn, url: postUrl(urn) }
  },

  async fetchPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
    const token = account.accessToken
    const encoded = encodeURIComponent(externalId)
    const result: PostMetricsResult = {}

    // Organization posts: impressions, clicks, shares (+ likes/comments)
    const author = authorUrnFor(account)
    if (author.startsWith('urn:li:organization:')) {
      const param = externalId.startsWith('urn:li:ugcPost:') ? 'ugcPosts' : 'shares'
      try {
        const res = await fetch(
          `${REST}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(
            author
          )}&${param}=List(${encoded})`,
          { headers: restHeaders(token), cache: 'no-store' }
        )
        if (res.status === 401) throw await platformErrorFromResponse(res, 'LinkedIn post metrics')
        if (res.ok) {
          const body = (await res.json()) as {
            elements?: {
              totalShareStatistics?: {
                impressionCount?: number
                clickCount?: number
                likeCount?: number
                commentCount?: number
                shareCount?: number
              }
            }[]
          }
          const stats = body.elements?.[0]?.totalShareStatistics
          if (stats) {
            if (typeof stats.impressionCount === 'number') result.impressions = stats.impressionCount
            if (typeof stats.clickCount === 'number') result.clicks = stats.clickCount
            if (typeof stats.shareCount === 'number') result.shares = stats.shareCount
            if (typeof stats.likeCount === 'number') result.likes = Math.max(0, stats.likeCount)
            if (typeof stats.commentCount === 'number') result.comments = stats.commentCount
          } else if (Array.isArray(body.elements)) {
            // Posts with no activity are omitted from the response
            result.impressions = 0
            result.clicks = 0
            result.shares = 0
          }
        }
      } catch (err) {
        if (err instanceof PlatformError && err.reauthRequired) throw err
      }
    }

    // Likes / comments as shown in the feed (needs r_*_social or *_social_feed scopes)
    try {
      const res = await fetch(`${REST}/socialActions/${encoded}`, {
        headers: restHeaders(token),
        cache: 'no-store',
      })
      if (res.status === 401) throw await platformErrorFromResponse(res, 'LinkedIn post metrics')
      if (res.ok) {
        const body = (await res.json()) as {
          likesSummary?: { totalLikes?: number; aggregatedTotalLikes?: number }
          commentsSummary?: { aggregatedTotalComments?: number; totalFirstLevelComments?: number }
        }
        // An empty object means "no likes or comments yet"
        result.likes = body.likesSummary?.aggregatedTotalLikes ?? body.likesSummary?.totalLikes ?? 0
        result.comments =
          body.commentsSummary?.aggregatedTotalComments ??
          body.commentsSummary?.totalFirstLevelComments ??
          0
      } else {
        // Fall back to socialMetadata (reactions) — same permission family
        const meta = await fetch(`${REST}/socialMetadata/${encoded}`, {
          headers: restHeaders(token),
          cache: 'no-store',
        })
        if (meta.ok) {
          const body = (await meta.json()) as {
            reactionSummaries?: Record<string, { count?: number }>
            commentSummary?: { count?: number }
          }
          const reactions = Object.values(body.reactionSummaries ?? {}).reduce(
            (sum, r) => sum + (r?.count ?? 0),
            0
          )
          result.likes = reactions
          if (typeof body.commentSummary?.count === 'number') result.comments = body.commentSummary.count
        }
      }
    } catch (err) {
      if (err instanceof PlatformError && err.reauthRequired) throw err
      // missing scopes / network — return what we have
    }

    return result
  },

  async fetchAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
    const author = authorUrnFor(account)
    if (!author.startsWith('urn:li:organization:')) return {}
    try {
      const res = await fetch(
        `${REST}/networkSizes/${encodeURIComponent(author)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
        { headers: restHeaders(account.accessToken), cache: 'no-store' }
      )
      if (res.status === 401) throw await platformErrorFromResponse(res, 'LinkedIn follower count')
      if (!res.ok) return {}
      const body = (await res.json()) as { firstDegreeSize?: number }
      return typeof body.firstDegreeSize === 'number' ? { followers: body.firstDegreeSize } : {}
    } catch (err) {
      if (err instanceof PlatformError && err.reauthRequired) throw err
      return {}
    }
  },
}
