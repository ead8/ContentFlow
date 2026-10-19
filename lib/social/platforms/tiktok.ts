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
 * TikTok adapter — Login Kit (OAuth v2) + Content Posting API (Direct Post,
 * FILE_UPLOAD) + Display API (video/query, user/info).
 *
 * Docs:
 *  - https://developers.tiktok.com/doc/login-kit-web
 *  - https://developers.tiktok.com/doc/oauth-user-access-token-management
 *  - https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *  - https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
 *
 * Unaudited apps: posts are forced to private (SELF_ONLY) and only private
 * TikTok accounts can be posted to until the app passes TikTok's audit.
 */

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const API = 'https://open.tiktokapis.com/v2'
const TOKEN_URL = `${API}/oauth/token/`

const DEFAULT_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.publish',
  'video.list',
]

const CAPTION_LIMIT = 2200
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024 // 1 GiB (TikTok itself allows 4 GB)
/** Files up to this size are sent as one chunk (TikTok: max 64 MB per chunk) */
const SINGLE_CHUNK_MAX = 64 * 1000 * 1000
/** Chunk size for larger files (TikTok: 5–64 MB, last chunk may be up to 128 MB) */
const CHUNK_SIZE = 10 * 1000 * 1000
const STATUS_POLL_TIMEOUT_MS = 120_000
const STATUS_POLL_INTERVAL_MS = 5_000

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(?:$|[?#])/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|svg)(?:$|[?#])/i

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clientKey(): string {
  const v = process.env.TIKTOK_CLIENT_KEY
  if (!v) throw new PlatformError('TikTok is not configured (TIKTOK_CLIENT_KEY missing)')
  return v
}

function clientSecret(): string {
  const v = process.env.TIKTOK_CLIENT_SECRET
  if (!v) throw new PlatformError('TikTok is not configured (TIKTOK_CLIENT_SECRET missing)')
  return v
}

function scopes(): string[] {
  const env = process.env.TIKTOK_SCOPES
  if (env && env.trim()) {
    return env
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return DEFAULT_SCOPES
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

/** The single video to publish, or a reason why there isn't exactly one */
function pickVideo(mediaUrls: string[]): { url: string } | { error: string } {
  const urls = (mediaUrls || []).filter(Boolean)
  const videos = urls.filter(isVideoUrl)
  if (videos.length > 1) return { error: 'TikTok posts can include only one video.' }
  if (videos.length === 1) return { url: videos[0] }
  // No recognisable video extension: accept a single non-image file and check
  // its Content-Type when downloading.
  const unknown = urls.filter((u) => !isImageUrl(u))
  if (unknown.length === 1) return { url: unknown[0] }
  return { error: 'TikTok needs exactly one video (mp4, mov or webm).' }
}

function videoMimeFor(url: string, contentType: string | null): string {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase()
  if (ct === 'video/mp4' || ct === 'video/quicktime' || ct === 'video/webm') return ct
  const p = urlPath(url).toLowerCase()
  if (p.endsWith('.mov')) return 'video/quicktime'
  if (p.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
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
    res = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) })
  } catch {
    throw new PlatformError('Could not download the video file for TikTok (network error).', {
      retryable: true,
    })
  }
  if (!res.ok) {
    throw new PlatformError(`Could not download the video file for TikTok (${res.status}).`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
    })
  }
  const contentType = res.headers.get('content-type')
  const ct = (contentType || '').toLowerCase()
  if (!isVideoUrl(url) && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
    throw new PlatformError('TikTok needs a video file; the attached media is not a video.')
  }
  const tooLarge = () =>
    new PlatformError(
      `The video is larger than ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB and cannot be auto-published to TikTok.`
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
    throw new PlatformError('Could not download the video file for TikTok (connection interrupted).', {
      retryable: true,
    })
  }
  if (total === 0) throw new PlatformError('The video file for TikTok is empty.')
  const data = new Uint8Array(new ArrayBuffer(total))
  let offset = 0
  for (let i = 0; i < parts.length; i++) {
    data.set(parts[i], offset)
    offset += parts[i].byteLength
  }
  return { data, size: total, contentType }
}

interface TikTokEnvelope<T> {
  data?: T
  error?: { code?: string; message?: string; log_id?: string; logid?: string }
}

const TIKTOK_ERROR_MESSAGES: Record<string, string> = {
  access_token_invalid: 'TikTok access has expired — please reconnect your TikTok account.',
  scope_not_authorized:
    'TikTok did not grant the permissions needed — please reconnect your TikTok account and allow all requested permissions.',
  spam_risk_too_many_posts: 'TikTok daily posting limit reached for this account. Try again tomorrow.',
  spam_risk_user_banned_from_posting: 'This TikTok account is currently banned from posting.',
  reached_active_user_cap:
    "The app's daily TikTok publishing quota has been reached. Try again tomorrow.",
  unaudited_client_can_only_post_to_private_accounts:
    'This app has not passed TikTok review yet, so it can only post to private TikTok accounts. Make your TikTok account private or publish manually.',
  privacy_level_option_mismatch: 'TikTok rejected the chosen privacy level for this account.',
  rate_limit_exceeded: 'TikTok rate limit reached; will retry shortly.',
  url_ownership_unverified: 'TikTok could not verify ownership of the video URL.',
}

/** PlatformError carrying TikTok's error code */
class TikTokApiError extends PlatformError {
  readonly code?: string
  constructor(
    message: string,
    opts: { retryable?: boolean; reauthRequired?: boolean; status?: number; code?: string }
  ) {
    super(message, opts)
    this.code = opts.code
  }
}

function tiktokError(
  label: string,
  status: number,
  code: string | undefined,
  message: string | undefined
): TikTokApiError {
  const known = code ? TIKTOK_ERROR_MESSAGES[code] : undefined
  const detail = known || (message ? String(message).slice(0, 300) : '') || code || ''
  const msg = known ? `${label}: ${known}` : `${label} failed (${status})${detail ? `: ${detail}` : ''}`
  const reauthRequired =
    status === 401 || code === 'access_token_invalid' || code === 'scope_not_authorized'
  const retryable =
    !reauthRequired && (status === 429 || status >= 500 || code === 'rate_limit_exceeded')
  return new TikTokApiError(msg, { reauthRequired, retryable, status, code })
}

/** Call a TikTok v2 API endpoint and unwrap `{ data, error }` */
async function tiktokApi<T>(
  path: string,
  accessToken: string,
  label: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(`${API}${path}`)
  if (init.query) {
    Object.keys(init.query).forEach((k) => url.searchParams.set(k, init.query![k]))
  }
  const method = init.method || 'GET'
  let res: Response
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new PlatformError(`${label} failed: could not reach TikTok.`, { retryable: true })
  }
  let json: TikTokEnvelope<T> | null = null
  try {
    json = (await res.json()) as TikTokEnvelope<T>
  } catch {
    json = null
  }
  const code = json?.error?.code
  if (!res.ok || (code && code !== 'ok')) {
    throw tiktokError(label, res.status, code, json?.error?.message)
  }
  return (json?.data ?? ({} as T)) as T
}

interface TikTokTokenResponse {
  access_token?: string
  expires_in?: number
  open_id?: string
  refresh_token?: string
  refresh_expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

async function tokenRequest(params: Record<string, string>, label: string): Promise<OAuthTokens> {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new PlatformError(`${label} failed: could not reach TikTok.`, { retryable: true })
  }
  let json: TikTokTokenResponse = {}
  try {
    json = (await res.json()) as TikTokTokenResponse
  } catch {
    // ignore
  }
  if (!res.ok || json.error || !json.access_token) {
    const desc = (json.error_description || json.error || `HTTP ${res.status}`).slice(0, 300)
    const retryable = res.status === 429 || res.status >= 500
    throw new PlatformError(`${label} failed: ${desc}`, {
      // A rejected refresh token means the user has to reconnect
      reauthRequired: !retryable && params.grant_type === 'refresh_token',
      retryable,
      status: res.status,
    })
  }
  const now = Date.now()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(now + json.expires_in * 1000) : null,
    refreshTokenExpiresAt: json.refresh_expires_in
      ? new Date(now + json.refresh_expires_in * 1000)
      : null,
    scopes: json.scope
      ? json.scope
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  }
}

interface CreatorInfo {
  creator_username?: string
  creator_nickname?: string
  creator_avatar_url?: string
  privacy_level_options?: string[]
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
  max_video_post_duration_sec?: number
}

interface StatusData {
  status?: string
  fail_reason?: string
  publicaly_available_post_id?: Array<string | number>
  // tolerate a future spelling fix
  publicly_available_post_id?: Array<string | number>
  uploaded_bytes?: number
}

function publicPostId(s: StatusData): string | null {
  const ids = s.publicaly_available_post_id || s.publicly_available_post_id
  if (ids && ids.length > 0 && ids[0] !== undefined && ids[0] !== null) return String(ids[0])
  return null
}

async function fetchStatus(accessToken: string, publishId: string): Promise<StatusData> {
  return tiktokApi<StatusData>('/post/publish/status/fetch/', accessToken, 'TikTok status check', {
    method: 'POST',
    body: { publish_id: publishId },
  })
}

function choosePrivacy(options: string[] | undefined): string {
  const opts = options || []
  const preferred = (process.env.TIKTOK_PRIVACY_LEVEL || 'PUBLIC_TO_EVERYONE').toUpperCase()
  if (opts.indexOf(preferred) !== -1) return preferred
  if (opts.indexOf('PUBLIC_TO_EVERYONE') !== -1) return 'PUBLIC_TO_EVERYONE'
  if (opts.length > 0) return opts[0]
  return 'SELF_ONLY'
}

/** Truncate to TikTok's 2200 UTF-16 code unit caption limit without splitting a surrogate pair */
function truncateCaption(text: string): string {
  const t = (text || '').trim()
  if (t.length <= CAPTION_LIMIT) return t
  let cut = t.slice(0, CAPTION_LIMIT)
  const last = cut.charCodeAt(cut.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1)
  return cut
}

async function putChunk(
  uploadUrl: string,
  body: Uint8Array,
  start: number,
  total: number,
  mime: string
): Promise<number> {
  const end = start + body.byteLength - 1
  let lastStatus = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt)
    let res: Response
    try {
      res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mime,
          'Content-Length': String(body.byteLength),
          'Content-Range': `bytes ${start}-${end}/${total}`,
        },
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(5 * 60_000),
      })
    } catch {
      lastStatus = 0
      continue
    }
    lastStatus = res.status
    if (res.status === 201 || res.status === 206 || res.ok) return res.status
    if (res.status < 500) {
      let detail = ''
      try {
        detail = (await res.text()).slice(0, 200)
      } catch {
        // ignore
      }
      throw new PlatformError(
        `TikTok video upload failed (${res.status})${detail ? `: ${detail}` : ''}`,
        { retryable: res.status === 403 || res.status === 404 || res.status === 416, status: res.status }
      )
    }
  }
  throw new PlatformError(
    `TikTok video upload failed${lastStatus ? ` (${lastStatus})` : ': network error'}.`,
    { retryable: true, status: lastStatus || undefined }
  )
}

function videoUrl(username: string | null | undefined, id: string): string | null {
  if (!username) return null
  return `https://www.tiktok.com/@${username}/video/${id}`
}

// ---------------------------------------------------------------------------
// adapter
// ---------------------------------------------------------------------------

export const tiktokAdapter: PlatformAdapter = {
  platform: 'Tiktok',

  isConfigured() {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
  },

  validate(req) {
    const picked = pickVideo(req.mediaUrls)
    if ('error' in picked) return picked.error
    if ((req.text || '').trim().length > CAPTION_LIMIT) {
      return `TikTok captions are limited to ${CAPTION_LIMIT} characters (this one has ${req.text.trim().length}).`
    }
    return null
  },

  getAuthorizationUrl({ state, redirectUri }: AuthorizationParams) {
    // Web Login Kit does not use PKCE (code_verifier is only for mobile/desktop apps).
    const url = new URL(AUTH_URL)
    url.searchParams.set('client_key', clientKey())
    url.searchParams.set('scope', scopes().join(','))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    return url.toString()
  },

  async exchangeCode({ code, redirectUri }: ExchangeParams) {
    return tokenRequest(
      {
        client_key: clientKey(),
        client_secret: clientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
      'TikTok sign-in'
    )
  },

  async refreshTokens(refreshToken: string) {
    return tokenRequest(
      {
        client_key: clientKey(),
        client_secret: clientSecret(),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      'TikTok token refresh'
    )
  },

  async fetchAccounts(tokens: OAuthTokens): Promise<ConnectedAccountInfo[]> {
    const granted = tokens.scopes && tokens.scopes.length ? tokens.scopes : scopes()
    const fields = ['open_id', 'union_id', 'avatar_url', 'display_name']
    if (granted.indexOf('user.info.profile') !== -1) fields.push('username')
    const data = await tiktokApi<{ user?: Record<string, unknown> }>(
      '/user/info/',
      tokens.accessToken,
      'TikTok profile lookup',
      { query: { fields: fields.join(',') } }
    )
    const user = data.user || {}
    const openId = String(user.open_id || '')
    if (!openId) throw new PlatformError('TikTok did not return an account id.')
    const username = typeof user.username === 'string' && user.username ? user.username : null
    const displayName =
      (typeof user.display_name === 'string' && user.display_name) || username || 'TikTok account'
    return [
      {
        accountId: openId,
        accountName: displayName,
        accountType: 'profile',
        avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
        metadata: {
          username,
          union_id: typeof user.union_id === 'string' ? user.union_id : null,
        },
      },
    ]
  },

  async publish(req: PublishRequest): Promise<PublishResult> {
    const picked = pickVideo(req.mediaUrls)
    if ('error' in picked) throw new PlatformError(picked.error)
    const token = req.account.accessToken

    // 1. Creator info → allowed privacy levels & interaction settings
    const creator = await tiktokApi<CreatorInfo>(
      '/post/publish/creator_info/query/',
      token,
      'TikTok creator info',
      { method: 'POST', body: {} }
    )
    const privacyLevel = choosePrivacy(creator.privacy_level_options)
    const username =
      creator.creator_username ||
      (typeof req.account.metadata?.username === 'string'
        ? (req.account.metadata.username as string)
        : null)

    // 2. Download the video
    const video = await downloadVideo(picked.url)
    const mime = videoMimeFor(picked.url, video.contentType)

    let chunkSize: number
    let chunkCount: number
    if (video.size <= SINGLE_CHUNK_MAX) {
      chunkSize = video.size
      chunkCount = 1
    } else {
      chunkSize = CHUNK_SIZE
      chunkCount = Math.floor(video.size / CHUNK_SIZE)
    }

    // 3. Init Direct Post
    const postInfo: Record<string, unknown> = {
      privacy_level: privacyLevel,
      disable_comment: Boolean(creator.comment_disabled),
      disable_duet: Boolean(creator.duet_disabled),
      disable_stitch: Boolean(creator.stitch_disabled),
      brand_content_toggle: false,
      brand_organic_toggle: false,
    }
    const caption = truncateCaption(req.text)
    if (caption) postInfo.title = caption

    const init = await tiktokApi<{ publish_id?: string; upload_url?: string }>(
      '/post/publish/video/init/',
      token,
      'TikTok publish',
      {
        method: 'POST',
        body: {
          post_info: postInfo,
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: video.size,
            chunk_size: chunkSize,
            total_chunk_count: chunkCount,
          },
        },
      }
    )
    const publishId = init.publish_id
    const uploadUrl = init.upload_url
    if (!publishId || !uploadUrl) {
      throw new PlatformError('TikTok publish failed: no upload URL returned.', { retryable: true })
    }

    // 4. Upload chunks sequentially (last chunk absorbs the remainder)
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize
      const end = i === chunkCount - 1 ? video.size : start + chunkSize
      await putChunk(uploadUrl, video.data.subarray(start, end), start, video.size, mime)
    }

    // 5. Poll status. From here on, never throw a retryable error: the upload is
    //    complete and a retry would create a duplicate post.
    const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(STATUS_POLL_INTERVAL_MS)
      let status: StatusData
      try {
        status = await fetchStatus(token, publishId)
      } catch (e) {
        if (e instanceof PlatformError && !e.retryable) break
        continue
      }
      if (status.status === 'PUBLISH_COMPLETE') {
        const postId = publicPostId(status)
        if (postId) return { externalId: postId, url: videoUrl(username, postId) }
        // Private (SELF_ONLY) or still in moderation: no public id yet.
        return { externalId: publishId, url: null }
      }
      if (status.status === 'FAILED') {
        throw new PlatformError(
          `TikTok could not publish the video${status.fail_reason ? `: ${status.fail_reason}` : '.'}`
        )
      }
      if (status.status === 'SEND_TO_USER_INBOX') {
        return { externalId: publishId, url: null }
      }
    }
    // Still processing: TikTok will finish on its side. Metrics lookup resolves
    // the public post id from the publish_id later.
    return { externalId: publishId, url: null }
  },

  async fetchPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
    let videoId = externalId
    if (!/^\d+$/.test(externalId)) {
      // externalId is a publish_id (post was still processing or private)
      try {
        const status = await fetchStatus(account.accessToken, externalId)
        const id = publicPostId(status)
        if (!id) return {}
        videoId = id
      } catch (e) {
        if (e instanceof PlatformError && (e.reauthRequired || e.retryable)) throw e
        return {}
      }
    }
    const data = await tiktokApi<{ videos?: Array<Record<string, unknown>> }>(
      '/video/query/',
      account.accessToken,
      'TikTok metrics',
      {
        method: 'POST',
        query: { fields: 'id,like_count,comment_count,share_count,view_count' },
        body: { filters: { video_ids: [videoId] } },
      }
    )
    const v = (data.videos || []).find((x) => String(x.id) === videoId) || (data.videos || [])[0]
    if (!v) return {}
    const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : undefined)
    const out: PostMetricsResult = {}
    const views = num(v.view_count)
    const likes = num(v.like_count)
    const comments = num(v.comment_count)
    const shares = num(v.share_count)
    if (views !== undefined) out.impressions = views
    if (likes !== undefined) out.likes = likes
    if (comments !== undefined) out.comments = comments
    if (shares !== undefined) out.shares = shares
    return out
  },

  async fetchAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
    try {
      const data = await tiktokApi<{ user?: { follower_count?: number } }>(
        '/user/info/',
        account.accessToken,
        'TikTok account stats',
        { query: { fields: 'open_id,follower_count' } }
      )
      const f = data.user?.follower_count
      return typeof f === 'number' ? { followers: f } : {}
    } catch (e) {
      // user.info.stats not granted → no follower count, but don't fail the sync
      if (e instanceof TikTokApiError && e.code === 'scope_not_authorized') return {}
      throw e
    }
  },
}
