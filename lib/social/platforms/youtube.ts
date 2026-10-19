import { createHash } from 'crypto'
import type {
  AccountMetricsResult,
  AuthorizationParams,
  ConnectedAccountInfo,
  ExchangeParams,
  OAuthTokens,
  PlatformAdapter,
  PostMetricsResult,
  PublishRequest,
  PublishResult,
  SocialAccount,
} from '../types'
import { PlatformError } from '../types'

/**
 * YouTube Shorts adapter — Google OAuth 2.0 (web server flow + PKCE) and the
 * YouTube Data API v3 resumable upload.
 *
 * Docs:
 *  - https://developers.google.com/identity/protocols/oauth2/web-server
 *  - https://developers.google.com/youtube/v3/docs/videos/insert
 *  - https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 *
 * A video is treated as a Short by YouTube when it is vertical/square and at
 * most 3 minutes long; "#Shorts" in the title is a hint only.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

const TITLE_LIMIT = 100
const DESCRIPTION_BYTE_LIMIT = 5000
const SHORTS_TAG = ' #Shorts'
const MAX_VIDEO_BYTES = 250 * 1024 * 1024 // whole file is buffered in memory; uploads are capped at 50 MB by storage

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(?:$|[?#])/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|svg)(?:$|[?#])/i

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID
  if (!v) throw new PlatformError('YouTube is not configured (GOOGLE_CLIENT_ID missing)')
  return v
}

function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET
  if (!v) throw new PlatformError('YouTube is not configured (GOOGLE_CLIENT_SECRET missing)')
  return v
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pkceChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function urlPath(u: string): string {
  try {
    return new URL(u).pathname
  } catch {
    return u
  }
}

function isVideoUrl(u: string): boolean {
  return VIDEO_EXT.test(urlPath(u))
}

function isImageUrl(u: string): boolean {
  return IMAGE_EXT.test(urlPath(u))
}

function pickVideo(mediaUrls: string[]): { url: string } | { error: string } {
  const urls = (mediaUrls || []).filter(Boolean)
  const videos = urls.filter(isVideoUrl)
  if (videos.length > 1) return { error: 'YouTube Shorts can include only one video.' }
  if (videos.length === 1) return { url: videos[0] }
  const unknown = urls.filter((u) => !isImageUrl(u))
  if (unknown.length === 1) return { url: unknown[0] }
  return { error: 'YouTube Shorts needs exactly one video (mp4, mov or webm).' }
}

function videoMimeFor(url: string, contentType: string | null): string {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct.startsWith('video/')) return ct
  const p = urlPath(url).toLowerCase()
  if (p.endsWith('.mov')) return 'video/quicktime'
  if (p.endsWith('.webm')) return 'video/webm'
  if (p.endsWith('.mp4') || p.endsWith('.m4v')) return 'video/mp4'
  return 'application/octet-stream'
}

interface DownloadedVideo {
  data: Uint8Array
  size: number
  contentType: string | null
}

/** Download a public media URL into memory, capped at MAX_VIDEO_BYTES */
async function downloadVideo(url: string): Promise<DownloadedVideo> {
  let res: Response
  try {
    res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5 * 60_000) })
  } catch {
    throw new PlatformError('Could not download the video file for YouTube (network error).', {
      retryable: true,
    })
  }
  if (!res.ok) {
    throw new PlatformError(`Could not download the video file for YouTube (${res.status}).`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
    })
  }
  const contentType = res.headers.get('content-type')
  const ct = (contentType || '').toLowerCase()
  if (!isVideoUrl(url) && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
    throw new PlatformError('YouTube Shorts needs a video file; the attached media is not a video.')
  }
  const tooLarge = () =>
    new PlatformError(
      `The video is larger than ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB and cannot be auto-published to YouTube.`
    )
  const declared = Number(res.headers.get('content-length') || '')
  if (declared && declared > MAX_VIDEO_BYTES) throw tooLarge()

  if (!res.body) {
    const ab = await res.arrayBuffer()
    if (ab.byteLength > MAX_VIDEO_BYTES) throw tooLarge()
    return { data: new Uint8Array(ab), size: ab.byteLength, contentType }
  }

  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_VIDEO_BYTES) {
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        throw tooLarge()
      }
      parts.push(value)
    }
  } catch (e) {
    if (e instanceof PlatformError) throw e
    throw new PlatformError('Could not download the video file for YouTube (connection interrupted).', {
      retryable: true,
    })
  }
  if (total === 0) throw new PlatformError('The video file for YouTube is empty.')
  const data = new Uint8Array(new ArrayBuffer(total))
  let offset = 0
  for (let i = 0; i < parts.length; i++) {
    data.set(parts[i], offset)
    offset += parts[i].byteLength
  }
  return { data, size: total, contentType }
}

interface GoogleErrorBody {
  error?:
    | string
    | {
        code?: number
        message?: string
        status?: string
        errors?: Array<{ reason?: string; message?: string; domain?: string }>
      }
  error_description?: string
}

// quotaExceeded is not retryable: the daily quota resets at midnight Pacific
// time, long after our 2-4 minute backoff.
const RETRYABLE_REASONS = [
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'backendError',
  'internalError',
]
const REAUTH_REASONS = ['authError', 'insufficientPermissions', 'invalid_grant']

const FRIENDLY: Record<string, string> = {
  quotaExceeded: 'The YouTube API daily quota is used up. Press Retry after midnight Pacific time.',
  rateLimitExceeded: 'YouTube rate limit reached; will retry shortly.',
  userRateLimitExceeded: 'YouTube rate limit reached; will retry shortly.',
  uploadLimitExceeded: 'This YouTube channel has reached its upload limit. Try again later.',
  youtubeSignupRequired:
    'This Google account has no YouTube channel. Create a channel on youtube.com, then reconnect.',
  insufficientPermissions:
    'YouTube permissions are missing — please reconnect YouTube and allow uploading.',
  forbiddenPrivacySetting: 'YouTube rejected the privacy setting for this video.',
  invalidTitle: 'YouTube rejected the video title.',
  invalidDescription: 'YouTube rejected the video description.',
}

/** Convert a failed Google API response into a PlatformError */
async function googleError(res: Response, label: string): Promise<PlatformError> {
  let body: GoogleErrorBody | null = null
  let text = ''
  try {
    text = await res.text()
    body = JSON.parse(text) as GoogleErrorBody
  } catch {
    body = null
  }
  let reason = ''
  let detail = ''
  if (body && typeof body.error === 'object' && body.error) {
    reason = body.error.errors?.[0]?.reason || ''
    detail = body.error.message || ''
  } else if (body && typeof body.error === 'string') {
    reason = body.error
    detail = body.error_description || body.error
  } else {
    detail = text
  }
  detail = String(detail).slice(0, 300)
  const friendly = reason ? FRIENDLY[reason] : undefined
  const message = friendly
    ? `${label}: ${friendly}`
    : `${label} failed (${res.status})${detail ? `: ${detail}` : ''}`

  const reauthRequired = res.status === 401 || REAUTH_REASONS.indexOf(reason) !== -1
  const retryable =
    !reauthRequired &&
    (res.status === 429 || res.status >= 500 || RETRYABLE_REASONS.indexOf(reason) !== -1)
  return new PlatformError(message, { reauthRequired, retryable, status: res.status })
}

async function apiGet<T>(path: string, accessToken: string, label: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new PlatformError(`${label} failed: could not reach YouTube.`, { retryable: true })
  }
  if (!res.ok) throw await googleError(res, label)
  return (await res.json()) as T
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
  token_type?: string
}

async function tokenRequest(params: Record<string, string>, label: string): Promise<OAuthTokens> {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new PlatformError(`${label} failed: could not reach Google.`, { retryable: true })
  }
  if (!res.ok) {
    const err = await googleError(res, label)
    const retryable = res.status === 429 || res.status >= 500
    // invalid_grant (revoked / expired refresh token) and other 4xx on refresh → reconnect
    throw new PlatformError(err.message, {
      reauthRequired: !retryable && params.grant_type === 'refresh_token',
      retryable,
      status: res.status,
    })
  }
  const json = (await res.json()) as GoogleTokenResponse
  if (!json.access_token) throw new PlatformError(`${label} failed: no access token returned.`)
  const now = Date.now()
  return {
    accessToken: json.access_token,
    // Google usually omits refresh_token on refresh; null means "keep the old one".
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(now + json.expires_in * 1000) : null,
    refreshTokenExpiresAt: json.refresh_token_expires_in
      ? new Date(now + json.refresh_token_expires_in * 1000)
      : null,
    scopes: json.scope ? json.scope.split(' ').filter(Boolean) : undefined,
  }
}

function stripAngleBrackets(s: string): string {
  // YouTube rejects "<" and ">" in titles and descriptions
  return s.replace(/[<>]/g, '')
}

/** Truncate a string to at most `maxChars` code points */
function truncateChars(s: string, maxChars: number): string {
  const chars = Array.from(s)
  if (chars.length <= maxChars) return s
  return chars.slice(0, maxChars).join('').trimEnd()
}

/** Truncate a string to at most `maxBytes` UTF-8 bytes without splitting characters */
function truncateBytes(s: string, maxBytes: number): string {
  if (Buffer.byteLength(s, 'utf8') <= maxBytes) return s
  const chars = Array.from(s)
  let bytes = 0
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const b = Buffer.byteLength(chars[i], 'utf8')
    if (bytes + b > maxBytes) break
    bytes += b
    out += chars[i]
  }
  return out
}

function buildTitle(title: string | null | undefined, text: string): string {
  let base = stripAngleBrackets((title || '').trim())
  if (!base) {
    const firstLine = (text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    base = stripAngleBrackets(firstLine || '')
  }
  base = base.replace(/\s+/g, ' ').trim() || 'New Short'
  base = truncateChars(base, TITLE_LIMIT)
  if (!/#shorts\b/i.test(base) && Array.from(base).length + SHORTS_TAG.length <= TITLE_LIMIT) {
    base += SHORTS_TAG
  }
  return base
}

function privacyStatus(): 'public' | 'unlisted' | 'private' {
  const v = (process.env.YOUTUBE_PRIVACY_STATUS || '').trim().toLowerCase()
  return v === 'private' || v === 'unlisted' ? v : 'public'
}

/** Upload bytes to a resumable session URI, resuming after transient failures */
async function uploadResumable(
  sessionUri: string,
  accessToken: string,
  data: Uint8Array,
  mime: string
): Promise<{ id?: string }> {
  const total = data.byteLength
  let offset = 0
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(2000 * Math.pow(2, attempt - 1), 10_000))
      // Ask the server how much it already has
      let probe: Response
      try {
        probe = await fetch(sessionUri, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': '0',
            'Content-Range': `bytes */${total}`,
          },
          signal: AbortSignal.timeout(30_000),
        })
      } catch {
        continue
      }
      if (probe.status === 200 || probe.status === 201) {
        return (await probe.json()) as { id?: string }
      }
      if (probe.status === 308) {
        const range = probe.headers.get('range')
        const m = range ? /bytes=0-(\d+)/.exec(range) : null
        offset = m ? Number(m[1]) + 1 : 0
      } else if (probe.status === 404) {
        throw new PlatformError('YouTube upload session expired; will retry.', {
          retryable: true,
          status: 404,
        })
      } else if (probe.status < 500) {
        throw await googleError(probe, 'YouTube upload')
      } else {
        continue
      }
    }

    const body = offset === 0 ? data : data.subarray(offset)
    let res: Response
    try {
      res = await fetch(sessionUri, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mime,
          'Content-Length': String(body.byteLength),
          ...(offset > 0 ? { 'Content-Range': `bytes ${offset}-${total - 1}/${total}` } : {}),
        },
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(10 * 60_000),
      })
    } catch {
      continue
    }
    if (res.status === 200 || res.status === 201) {
      return (await res.json()) as { id?: string }
    }
    if (res.status === 308 || res.status >= 500) continue
    if (res.status === 404) {
      throw new PlatformError('YouTube upload session expired; will retry.', {
        retryable: true,
        status: 404,
      })
    }
    throw await googleError(res, 'YouTube upload')
  }
  throw new PlatformError('YouTube upload did not complete; will retry.', { retryable: true })
}

// ---------------------------------------------------------------------------
// adapter
// ---------------------------------------------------------------------------

export const youtubeAdapter: PlatformAdapter = {
  platform: 'YouTube_Shorts',

  isConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  },

  validate(req) {
    const picked = pickVideo(req.mediaUrls)
    if ('error' in picked) return picked.error
    return null
  },

  getAuthorizationUrl({ state, redirectUri, codeVerifier }: AuthorizationParams) {
    const url = new URL(AUTH_URL)
    url.searchParams.set('client_id', clientId())
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', SCOPES.join(' '))
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', pkceChallenge(codeVerifier))
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  },

  async exchangeCode({ code, redirectUri, codeVerifier }: ExchangeParams) {
    return tokenRequest(
      {
        client_id: clientId(),
        client_secret: clientSecret(),
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      'Google sign-in'
    )
  },

  async refreshTokens(refreshToken: string) {
    return tokenRequest(
      {
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      'YouTube token refresh'
    )
  },

  async fetchAccounts(tokens: OAuthTokens): Promise<ConnectedAccountInfo[]> {
    const data = await apiGet<{
      items?: Array<{
        id: string
        snippet?: {
          title?: string
          customUrl?: string
          thumbnails?: Record<string, { url?: string } | undefined>
        }
      }>
    }>('/channels?part=snippet&mine=true', tokens.accessToken, 'YouTube channel lookup')
    const items = data.items || []
    if (items.length === 0) {
      throw new PlatformError(
        'This Google account has no YouTube channel. Create a channel on youtube.com, then connect again.'
      )
    }
    return items.map((c) => {
      const th = c.snippet?.thumbnails || {}
      const avatar = th.default?.url || th.medium?.url || th.high?.url || null
      return {
        accountId: c.id,
        accountName: c.snippet?.title || c.snippet?.customUrl || 'YouTube channel',
        accountType: 'channel',
        avatarUrl: avatar,
        metadata: { customUrl: c.snippet?.customUrl ?? null },
      }
    })
  },

  async publish(req: PublishRequest): Promise<PublishResult> {
    const picked = pickVideo(req.mediaUrls)
    if ('error' in picked) throw new PlatformError(picked.error)
    const token = req.account.accessToken

    const video = await downloadVideo(picked.url)
    const mime = videoMimeFor(picked.url, video.contentType)

    const description = truncateBytes(stripAngleBrackets((req.text || '').trim()), DESCRIPTION_BYTE_LIMIT)
    const metadata = {
      snippet: {
        title: buildTitle(req.title, req.text),
        description,
      },
      status: {
        privacyStatus: privacyStatus(),
        selfDeclaredMadeForKids: false,
      },
    }

    // 1. Start a resumable session
    let init: Response
    try {
      init = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(video.size),
          'X-Upload-Content-Type': mime,
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new PlatformError('YouTube upload failed: could not reach YouTube.', { retryable: true })
    }
    if (!init.ok) throw await googleError(init, 'YouTube upload')
    const sessionUri = init.headers.get('location')
    if (!sessionUri) {
      throw new PlatformError('YouTube upload failed: no upload session returned.', {
        retryable: true,
      })
    }

    // 2. Upload the bytes (the video is created when the upload completes)
    req.commit?.()
    const created = await uploadResumable(sessionUri, token, video.data, mime)
    if (!created.id) {
      // The upload completed, so don't retry (would create a duplicate).
      throw new PlatformError('YouTube accepted the upload but did not return a video id.')
    }
    return { externalId: created.id, url: `https://www.youtube.com/shorts/${created.id}` }
  },

  async fetchPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
    const data = await apiGet<{
      items?: Array<{
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
      }>
    }>(
      `/videos?part=statistics&id=${encodeURIComponent(externalId)}`,
      account.accessToken,
      'YouTube metrics'
    )
    const s = data.items?.[0]?.statistics
    if (!s) return {}
    const num = (v: string | undefined) => {
      if (v === undefined || v === null) return undefined
      const n = Number(v)
      return isFinite(n) ? n : undefined
    }
    const out: PostMetricsResult = {}
    const views = num(s.viewCount)
    const likes = num(s.likeCount)
    const comments = num(s.commentCount)
    if (views !== undefined) out.impressions = views
    if (likes !== undefined) out.likes = likes
    if (comments !== undefined) out.comments = comments
    return out
  },

  async fetchAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
    const data = await apiGet<{
      items?: Array<{ statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }>
    }>(
      `/channels?part=statistics&id=${encodeURIComponent(account.accountId)}`,
      account.accessToken,
      'YouTube channel stats'
    )
    const s = data.items?.[0]?.statistics
    if (!s || s.hiddenSubscriberCount || s.subscriberCount === undefined) return {}
    const n = Number(s.subscriberCount)
    return isFinite(n) ? { followers: n } : {}
  },
}
