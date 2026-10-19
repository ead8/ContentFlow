import { createHash } from 'crypto'
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
 * X (Twitter) adapter (server-only).
 *
 * - Auth: OAuth 2.0 Authorization Code with PKCE (S256), confidential client
 *   (HTTP Basic client_id:client_secret at the token endpoint). Access tokens
 *   last ~2 hours; refresh tokens (offline.access) rotate on every refresh.
 * - Publishing: POST /2/tweets; media via the v2 media endpoints
 *   (POST /2/media/upload for images, initialize/append/finalize for video).
 *
 * Docs: https://docs.x.com/x-api/posts/creation-of-a-post
 *       https://docs.x.com/x-api/media/quickstart/media-upload-chunked
 */

const AUTH_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const API = 'https://api.x.com/2'

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write']

const MAX_WEIGHTED_CHARS = 280
const URL_WEIGHT = 23
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_GIF_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_BYTES = 512 * 1024 * 1024
const CHUNK_BYTES = 4 * 1024 * 1024
const PROCESSING_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function clientId(): string {
  const v = process.env.X_CLIENT_ID
  if (!v) throw new PlatformError('X is not configured (X_CLIENT_ID is missing)')
  return v
}

function basicAuthHeader(): string {
  const secret = process.env.X_CLIENT_SECRET
  if (!secret) throw new PlatformError('X is not configured (X_CLIENT_SECRET is missing)')
  return `Basic ${Buffer.from(`${clientId()}:${secret}`).toString('base64')}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pkceChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
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

/** platformErrorFromResponse plus X-specific wording for common cases */
async function xError(res: Response, label: string): Promise<PlatformError> {
  const err = await platformErrorFromResponse(res, label)
  if (res.status === 402) {
    return new PlatformError(
      `${err.message}. The X developer account has no API credits/plan for this request.`,
      { status: 402 }
    )
  }
  if (res.status === 403 && /duplicate/i.test(err.message)) {
    return new PlatformError('X rejected this post because it duplicates a recent post', { status: 403 })
  }
  return err
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

interface XTokenResponse {
  token_type?: string
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

async function tokenRequest(params: Record<string, string>, label: string): Promise<OAuthTokens> {
  const res = await safeFetch(
    TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
      cache: 'no-store',
    },
    label
  )
  if (!res.ok) {
    const err = await platformErrorFromResponse(res, label)
    // invalid_grant / invalid_request: code or refresh token no longer valid
    if (res.status === 400 || res.status === 401) {
      throw new PlatformError(err.message, { reauthRequired: true, status: res.status })
    }
    throw err
  }
  const body = (await res.json()) as XTokenResponse
  if (!body.access_token) throw new PlatformError(`${label} failed: X did not return an access token`)
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    refreshTokenExpiresAt: null,
    scopes: body.scope ? body.scope.split(/\s+/).filter(Boolean) : undefined,
  }
}

// ---------------------------------------------------------------------------
// Text length (approximation of twitter-text weighted length)
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s]+/gi

/** Code points that X counts as 1; everything else (CJK, emoji, ...) counts as 2 */
function codePointWeight(cp: number): number {
  if (
    (cp >= 0 && cp <= 4351) ||
    (cp >= 8192 && cp <= 8205) ||
    (cp >= 8208 && cp <= 8223) ||
    (cp >= 8242 && cp <= 8247)
  ) {
    return 1
  }
  return 2
}

function graphemes(s: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(s), (x) => x.segment)
  }
  return Array.from(s)
}

/** Weighted length as X counts it: URLs = 23, emoji/CJK = 2, most others = 1 */
export function xWeightedLength(text: string): number {
  const normalized = (text ?? '').normalize('NFC')
  let length = 0
  const withoutUrls = normalized.replace(URL_RE, () => {
    length += URL_WEIGHT
    return ''
  })
  for (const g of graphemes(withoutUrls)) {
    // Emoji sequences (ZWJ, skin tones, flags) count once, as 2
    let weight = 0
    for (const ch of Array.from(g)) weight = Math.max(weight, codePointWeight(ch.codePointAt(0) ?? 0))
    length += weight
  }
  return length
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i

function urlPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0]
  }
}

function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(urlPath(url))
}

type MediaKind = 'image' | 'gif' | 'video'

interface DownloadedMedia {
  data: ArrayBuffer
  contentType: string
  kind: MediaKind
}

function guessContentType(url: string): string {
  const ext = urlPath(url).split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'mov':
      return 'video/quicktime'
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    default:
      return 'application/octet-stream'
  }
}

async function downloadMedia(url: string): Promise<DownloadedMedia> {
  const res = await safeFetch(url, { cache: 'no-store' }, 'Downloading media for X')
  if (!res.ok) {
    throw new PlatformError(`Could not download a media file for X (HTTP ${res.status})`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
    })
  }
  let contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType || contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
    contentType = guessContentType(url)
  }
  const kind: MediaKind =
    contentType.startsWith('video/') || isVideoUrl(url)
      ? 'video'
      : contentType === 'image/gif'
        ? 'gif'
        : 'image'
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : kind === 'gif' ? MAX_GIF_BYTES : MAX_IMAGE_BYTES
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > limit) {
    throw new PlatformError(
      `A ${kind} is too large for X (${Math.round(declared / 1024 / 1024)} MB; max ${Math.round(limit / 1024 / 1024)} MB)`
    )
  }
  const data = await res.arrayBuffer()
  if (data.byteLength > limit) {
    throw new PlatformError(
      `A ${kind} is too large for X (${Math.round(data.byteLength / 1024 / 1024)} MB; max ${Math.round(limit / 1024 / 1024)} MB)`
    )
  }
  if (data.byteLength === 0) throw new PlatformError('A media file for X is empty')
  if (kind === 'video' && contentType === 'application/octet-stream') contentType = 'video/mp4'
  return { data, contentType, kind }
}

interface ProcessingInfo {
  state?: 'pending' | 'in_progress' | 'succeeded' | 'failed'
  check_after_secs?: number
  progress_percent?: number
  error?: { message?: string; name?: string }
}

interface MediaResponse {
  data?: { id?: string; media_key?: string; processing_info?: ProcessingInfo }
  processing_info?: ProcessingInfo
}

function mediaCategory(kind: MediaKind): string {
  return kind === 'video' ? 'tweet_video' : kind === 'gif' ? 'tweet_gif' : 'tweet_image'
}

async function waitForProcessing(
  accessToken: string,
  mediaId: string,
  initial: ProcessingInfo | undefined
): Promise<void> {
  let info = initial
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS
  while (info && info.state !== 'succeeded') {
    if (info.state === 'failed') {
      throw new PlatformError(
        `X could not process the media${info.error?.message ? `: ${info.error.message}` : ''}`
      )
    }
    if (Date.now() > deadline) {
      throw new PlatformError('X is taking too long to process the media; will retry later', {
        retryable: true,
      })
    }
    const waitSecs = Math.min(Math.max(info.check_after_secs ?? 2, 1), 10)
    await sleep(waitSecs * 1000)
    const res = await safeFetch(
      `${API}/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
      'X media status'
    )
    if (!res.ok) throw await xError(res, 'X media status')
    const body = (await res.json()) as MediaResponse
    info = body.data?.processing_info ?? body.processing_info
  }
}

/** Single-request upload (images and small GIFs) */
async function uploadSimple(accessToken: string, media: DownloadedMedia): Promise<string> {
  const form = new FormData()
  form.append('media', new Blob([media.data], { type: media.contentType }), 'media')
  form.append('media_category', mediaCategory(media.kind))
  const res = await safeFetch(
    `${API}/media/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
      cache: 'no-store',
    },
    'X media upload'
  )
  if (!res.ok) throw await xError(res, 'X media upload')
  const body = (await res.json()) as MediaResponse
  const id = body.data?.id
  if (!id) throw new PlatformError('X media upload failed: no media id returned', { retryable: true })
  await waitForProcessing(accessToken, id, body.data?.processing_info)
  return id
}

/** Chunked upload: initialize → append (≤4 MB parts) → finalize → poll status */
async function uploadChunked(accessToken: string, media: DownloadedMedia): Promise<string> {
  const auth = { Authorization: `Bearer ${accessToken}` }

  const init = await safeFetch(
    `${API}/media/upload/initialize`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: media.contentType,
        total_bytes: media.data.byteLength,
        media_category: mediaCategory(media.kind),
      }),
      cache: 'no-store',
    },
    'X media upload'
  )
  if (!init.ok) throw await xError(init, 'X media upload')
  const initBody = (await init.json()) as MediaResponse
  const id = initBody.data?.id
  if (!id) throw new PlatformError('X media upload failed: no media id returned', { retryable: true })

  let segment = 0
  for (let offset = 0; offset < media.data.byteLength; offset += CHUNK_BYTES) {
    const chunk = media.data.slice(offset, Math.min(offset + CHUNK_BYTES, media.data.byteLength))
    const form = new FormData()
    form.append('segment_index', String(segment))
    form.append('media', new Blob([chunk], { type: 'application/octet-stream' }), 'chunk')
    const res = await safeFetch(
      `${API}/media/upload/${encodeURIComponent(id)}/append`,
      { method: 'POST', headers: auth, body: form, cache: 'no-store' },
      'X media upload'
    )
    if (!res.ok) throw await xError(res, 'X media upload')
    segment++
  }

  const fin = await safeFetch(
    `${API}/media/upload/${encodeURIComponent(id)}/finalize`,
    { method: 'POST', headers: auth, cache: 'no-store' },
    'X media upload'
  )
  if (!fin.ok) throw await xError(fin, 'X media upload')
  const finBody = (await fin.json()) as MediaResponse
  await waitForProcessing(accessToken, id, finBody.data?.processing_info ?? finBody.processing_info)
  return id
}

async function uploadMedia(accessToken: string, media: DownloadedMedia): Promise<string> {
  if (media.kind === 'video' || (media.kind === 'gif' && media.data.byteLength > MAX_IMAGE_BYTES)) {
    return uploadChunked(accessToken, media)
  }
  return uploadSimple(accessToken, media)
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

interface XUser {
  id: string
  name?: string
  username?: string
  profile_image_url?: string
  public_metrics?: { followers_count?: number }
}

function usernameFor(account: SocialAccount): string | null {
  const u = account.metadata?.username
  return typeof u === 'string' && u ? u : null
}

export const xAdapter: PlatformAdapter = {
  platform: 'X-Twitter',

  isConfigured() {
    return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET)
  },

  validate({ text, mediaUrls }) {
    const length = xWeightedLength(text ?? '')
    if (length > MAX_WEIGHTED_CHARS) {
      return `X posts can be at most ${MAX_WEIGHTED_CHARS} characters (this one counts as ${length}; links count as ${URL_WEIGHT})`
    }
    if (!text?.trim() && mediaUrls.length === 0) return 'X posts need text or media'
    const videos = mediaUrls.filter(isVideoUrl)
    if (videos.length > 1) return 'X posts can include only one video'
    if (videos.length === 1 && mediaUrls.length > 1) {
      return 'X posts can include up to 4 images or one video, not both'
    }
    if (mediaUrls.length > MAX_IMAGES) return `X posts can include at most ${MAX_IMAGES} images`
    return null
  },

  getAuthorizationUrl({ state, redirectUri, codeVerifier }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
    })
    return `${AUTH_URL}?${params.toString().replace(/\+/g, '%20')}`
  },

  async exchangeCode({ code, redirectUri, codeVerifier }) {
    return tokenRequest(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: clientId(),
      },
      'X sign-in'
    )
  },

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new PlatformError('X session expired — please reconnect your X account', {
        reauthRequired: true,
      })
    }
    // X rotates refresh tokens: the returned one replaces the old one
    return tokenRequest(
      { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId() },
      'X token refresh'
    )
  },

  async fetchAccounts(tokens): Promise<ConnectedAccountInfo[]> {
    const res = await safeFetch(
      `${API}/users/me?user.fields=profile_image_url,username,name`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` }, cache: 'no-store' },
      'X profile lookup'
    )
    if (!res.ok) throw await xError(res, 'X profile lookup')
    const body = (await res.json()) as { data?: XUser }
    const user = body.data
    if (!user?.id) throw new PlatformError('X did not return the account profile')
    return [
      {
        accountId: user.id,
        accountName: user.username ? `@${user.username}` : user.name || 'X account',
        accountType: 'profile',
        // _normal is 48x48; _400x400 is a sharper variant of the same image
        avatarUrl: user.profile_image_url ? user.profile_image_url.replace('_normal.', '_400x400.') : null,
        metadata: { username: user.username ?? null, name: user.name ?? null },
      },
    ]
  },

  async publish(req: PublishRequest): Promise<PublishResult> {
    const problem = xAdapter.validate?.(req)
    if (problem) throw new PlatformError(problem)

    const token = req.account.accessToken
    const mediaIds: string[] = []
    const urls = req.mediaUrls ?? []
    if (urls.length > 0) {
      const files: DownloadedMedia[] = []
      for (const url of urls) files.push(await downloadMedia(url))
      const videos = files.filter((f) => f.kind !== 'image')
      if (videos.length > 0 && files.length > 1) {
        throw new PlatformError('X posts can include up to 4 images, or a single video/GIF')
      }
      for (const file of files) mediaIds.push(await uploadMedia(token, file))
    }

    const payload: Record<string, unknown> = {}
    if (req.text?.trim()) payload.text = req.text
    if (mediaIds.length) payload.media = { media_ids: mediaIds }

    const res = await safeFetch(
      `${API}/tweets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
      'X publish'
    )
    if (!res.ok) throw await xError(res, 'X publish')
    const body = (await res.json()) as { data?: { id?: string } }
    const id = body.data?.id
    if (!id) {
      // The post may exist; don't retry automatically (would double-post)
      throw new PlatformError('X accepted the post but did not return its id')
    }
    const username = usernameFor(req.account)
    return {
      externalId: id,
      url: username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}`,
    }
  },

  async fetchPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
    const headers = { Authorization: `Bearer ${account.accessToken}` }
    const id = encodeURIComponent(externalId)

    type TweetMetrics = {
      data?: {
        public_metrics?: {
          retweet_count?: number
          reply_count?: number
          like_count?: number
          quote_count?: number
          impression_count?: number
          bookmark_count?: number
        }
        non_public_metrics?: {
          impression_count?: number
          url_link_clicks?: number
          user_profile_clicks?: number
        }
      }
    }

    // non_public_metrics only works for the author's own posts < 30 days old
    let body: TweetMetrics | null = null
    for (const fields of ['public_metrics,non_public_metrics', 'public_metrics']) {
      const res = await safeFetch(
        `${API}/tweets/${id}?tweet.fields=${fields}`,
        { headers, cache: 'no-store' },
        'X post metrics'
      )
      if (res.status === 401 || res.status === 429) throw await xError(res, 'X post metrics')
      if (res.ok) {
        const json = (await res.json()) as TweetMetrics
        if (json.data) {
          body = json
          break
        }
      } else if (res.status >= 500) {
        throw await xError(res, 'X post metrics')
      }
    }
    if (!body?.data) return {}

    const pub = body.data.public_metrics ?? {}
    const priv = body.data.non_public_metrics ?? {}
    const result: PostMetricsResult = {}
    if (typeof pub.like_count === 'number') result.likes = pub.like_count
    if (typeof pub.reply_count === 'number') result.comments = pub.reply_count
    if (typeof pub.retweet_count === 'number' || typeof pub.quote_count === 'number') {
      result.shares = (pub.retweet_count ?? 0) + (pub.quote_count ?? 0)
    }
    const impressions = priv.impression_count ?? pub.impression_count
    if (typeof impressions === 'number') result.impressions = impressions
    if (typeof priv.url_link_clicks === 'number') result.clicks = priv.url_link_clicks
    return result
  },

  async fetchAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
    const res = await safeFetch(
      `${API}/users/me?user.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${account.accessToken}` }, cache: 'no-store' },
      'X account metrics'
    )
    if (res.status === 401) throw await xError(res, 'X account metrics')
    if (!res.ok) return {}
    const body = (await res.json()) as { data?: XUser }
    const followers = body.data?.public_metrics?.followers_count
    return typeof followers === 'number' ? { followers } : {}
  },
}
