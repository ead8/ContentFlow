import { createHmac } from 'crypto'
import {
  PlatformError,
  type AccountMetricsResult,
  type AuthorizationParams,
  type ConnectedAccountInfo,
  type ExchangeParams,
  type OAuthTokens,
  type PlatformAdapter,
  type PostMetricsResult,
  type PublishRequest,
  type PublishResult,
  type SocialAccount,
} from '../types'

/**
 * Facebook Pages + Instagram (Business/Creator accounts linked to a Page)
 * through the Meta Graph API, both authorised with Facebook Login using
 * META_APP_ID / META_APP_SECRET.
 *
 * Tokens: the OAuth code is exchanged for a long-lived (~60 day) user token;
 * the Page access tokens obtained with it do not expire, so each connected
 * Page / Instagram account stores its Page token and there is no refresh.
 *
 * Optional env:
 * - META_GRAPH_VERSION         Graph API version (default below)
 * - META_FACEBOOK_CONFIG_ID    Facebook Login for Business configuration for
 *   META_INSTAGRAM_CONFIG_ID   the Facebook / Instagram connect flows. When set,
 *                              `config_id` is sent instead of `scope`.
 * - META_EXTRA_SCOPES          comma-separated extra permissions to request
 *                              (e.g. business_management for Pages owned by a
 *                              business portfolio)
 */

const DEFAULT_GRAPH_VERSION = 'v26.0'
const GRAPH_HOST = 'https://graph.facebook.com'
const GRAPH_VIDEO_HOST = 'https://graph-video.facebook.com'

const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights']
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
]

const FB_TEXT_LIMIT = 63206
const FB_MAX_PHOTOS = 30
const IG_CAPTION_LIMIT = 2200
const IG_MAX_MEDIA = 10
const IG_MAX_HASHTAGS = 30
const IG_MAX_MENTIONS = 20

/** Total time budget for waiting on Instagram container processing */
const IG_POLL_BUDGET_MS = 90_000

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function graphVersion(): string {
  const v = (process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim()
  return v.startsWith('v') ? v : `v${v}`
}

function appId(): string {
  const id = process.env.META_APP_ID
  if (!id) throw new PlatformError('Meta integration is not configured (META_APP_ID missing)')
  return id
}

function appSecret(): string {
  const secret = process.env.META_APP_SECRET
  if (!secret) throw new PlatformError('Meta integration is not configured (META_APP_SECRET missing)')
  return secret
}

function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

function extraScopes(): string[] {
  return (process.env.META_EXTRA_SCOPES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** appsecret_proof: HMAC-SHA256 of the access token keyed with the app secret */
function appSecretProof(token: string): string | null {
  const secret = process.env.META_APP_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(token).digest('hex')
}

// ---------------------------------------------------------------------------
// Graph request + error mapping
// ---------------------------------------------------------------------------

interface GraphErrorBody {
  message?: string
  type?: string
  code?: number
  error_subcode?: number
  is_transient?: boolean
  error_user_title?: string
  error_user_msg?: string
}

/** Graph error codes that mean "slow down / try again later" */
const RETRYABLE_CODES = [1, 2, 4, 17, 32, 341, 368, 613]
/** Token is invalid / expired / revoked */
const REAUTH_CODES = [102, 190]
/** Instagram subcodes that are worth retrying (media not ready yet) */
const RETRYABLE_IG_SUBCODES = [2207027, 2207003, 2207020]

type GraphParamValue = string | number | boolean | null | undefined
type GraphParams = Record<string, GraphParamValue>

function graphErrorToPlatformError(
  label: string,
  status: number,
  err: GraphErrorBody | null,
  fallbackText: string
): PlatformError {
  if (!err) {
    const detail = fallbackText.slice(0, 300)
    const message = `${label} failed (${status})${detail ? `: ${detail}` : ''}`
    if (status === 401) return new PlatformError(message, { reauthRequired: true, status })
    return new PlatformError(message, { retryable: status === 429 || status >= 500, status })
  }

  const code = typeof err.code === 'number' ? err.code : undefined
  const sub = typeof err.error_subcode === 'number' ? err.error_subcode : undefined
  const human = (err.error_user_msg || err.message || 'Unknown error').slice(0, 300)
  const message = `${label} failed: ${human}`

  if ((code !== undefined && REAUTH_CODES.indexOf(code) !== -1) || status === 401) {
    return new PlatformError(`${label} failed: the connection has expired or was revoked. Please reconnect the account.`, {
      reauthRequired: true,
      status,
    })
  }
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) {
    return new PlatformError(`${message} (missing permission — reconnect the account and grant all requested permissions)`, {
      status,
    })
  }
  const retryable =
    err.is_transient === true ||
    (code !== undefined && RETRYABLE_CODES.indexOf(code) !== -1) ||
    (code !== undefined && code >= 80001 && code <= 80014) || // business use case rate limits
    (sub !== undefined && RETRYABLE_IG_SUBCODES.indexOf(sub) !== -1) ||
    status === 429 ||
    status >= 500
  return new PlatformError(message, { retryable, status })
}

async function graphRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: {
    label: string
    token?: string
    params?: GraphParams
    host?: string
    timeoutMs?: number
  }
): Promise<T> {
  const params: Record<string, string> = {}
  for (const key of Object.keys(opts.params || {})) {
    const v = (opts.params || {})[key]
    if (v === undefined || v === null) continue
    params[key] = String(v)
  }
  if (opts.token) {
    params.access_token = opts.token
    const proof = appSecretProof(opts.token)
    if (proof) params.appsecret_proof = proof
  }

  const base = `${opts.host || GRAPH_HOST}/${graphVersion()}/${path.replace(/^\/+/, '')}`
  const qs = new URLSearchParams(params).toString()
  const url = method === 'GET' && qs ? `${base}?${qs}` : base

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers:
        method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
          : { Accept: 'application/json' },
      body: method === 'POST' ? qs : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    })
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'request timed out' : 'network error'
    throw new PlatformError(`${opts.label} failed: ${reason}`, { retryable: true })
  }

  const text = await res.text().catch(() => '')
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const errObj =
    body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'object'
      ? ((body as { error: GraphErrorBody }).error ?? null)
      : null

  if (!res.ok || errObj) {
    throw graphErrorToPlatformError(opts.label, res.status, errObj, body ? '' : text)
  }
  return body as T
}

function graphGet<T>(path: string, token: string | undefined, params: GraphParams, label: string): Promise<T> {
  return graphRequest<T>('GET', path, { token, params, label })
}

function graphPost<T>(
  path: string,
  token: string,
  params: GraphParams,
  label: string,
  extra: { host?: string; timeoutMs?: number } = {}
): Promise<T> {
  return graphRequest<T>('POST', path, { token, params, label, ...extra })
}

/** Follow `paging.next` cursors for list edges (bounded) */
async function graphGetAll<T>(
  path: string,
  token: string,
  params: GraphParams,
  label: string,
  maxPages = 10
): Promise<T[]> {
  const out: T[] = []
  let after: string | undefined
  for (let i = 0; i < maxPages; i++) {
    const page = await graphGet<{ data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      path,
      token,
      { ...params, after },
      label
    )
    out.push(...(page.data || []))
    after = page.paging?.cursors?.after
    if (!page.paging?.next || !after) break
  }
  return out
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i
const NON_JPEG_IMAGE_EXT = /\.(png|gif|webp|heic|heif|avif|bmp|tiff?)$/i

function urlPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0]
  }
}

function isVideoUrlByExtension(url: string): boolean {
  return VIDEO_EXT.test(urlPath(url))
}

/** Video detection: extension first, then a HEAD request's Content-Type */
async function isVideoUrl(url: string): Promise<boolean> {
  if (isVideoUrlByExtension(url)) return true
  if (/\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(urlPath(url))) return false
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    return (res.headers.get('content-type') || '').toLowerCase().startsWith('video/')
  } catch {
    return false
  }
}

async function classifyMedia(urls: string[]): Promise<{ url: string; video: boolean }[]> {
  return Promise.all(urls.map(async (url) => ({ url, video: await isVideoUrl(url) })))
}

// ---------------------------------------------------------------------------
// OAuth (shared by both adapters)
// ---------------------------------------------------------------------------

function buildAuthorizationUrl(params: AuthorizationParams, scopes: string[], configIdEnv: string): string {
  const q = new URLSearchParams({
    client_id: appId(),
    redirect_uri: params.redirectUri,
    state: params.state,
    response_type: 'code',
  })
  const configId = process.env[configIdEnv]
  if (configId) {
    // Facebook Login for Business: permissions come from the configuration
    q.set('config_id', configId)
    q.set('override_default_response_type', 'true')
  } else {
    const all = scopes.concat(extraScopes()).filter((s, i, arr) => arr.indexOf(s) === i)
    q.set('scope', all.join(','))
    // Re-ask for permissions the user declined on a previous attempt
    q.set('auth_type', 'rerequest')
  }
  return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${q.toString()}`
}

interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

async function exchangeCodeForLongLivedToken(params: ExchangeParams, label: string): Promise<OAuthTokens> {
  const short = await graphGet<TokenResponse>(
    'oauth/access_token',
    undefined,
    {
      client_id: appId(),
      client_secret: appSecret(),
      redirect_uri: params.redirectUri,
      code: params.code,
    },
    `${label} token exchange`
  )
  if (!short?.access_token) throw new PlatformError(`${label} token exchange failed: no access token returned`)

  // Must succeed: Page tokens derived from a short-lived user token expire in
  // ~1 hour, while those from a long-lived one never expire.
  const long = await graphGet<TokenResponse>(
    'oauth/access_token',
    undefined,
    {
      grant_type: 'fb_exchange_token',
      client_id: appId(),
      client_secret: appSecret(),
      fb_exchange_token: short.access_token,
    },
    `${label} long-lived token exchange`
  )
  if (!long?.access_token) throw new PlatformError(`${label} long-lived token exchange failed: no access token returned`)
  const token = long.access_token
  // Long-lived user tokens last ~60 days; expires_in is sometimes omitted
  const expiresIn = long.expires_in ?? 60 * 24 * 60 * 60

  let scopes: string[] | undefined
  try {
    scopes = await grantedPermissions(token)
  } catch {
    scopes = undefined
  }

  return {
    accessToken: token,
    refreshToken: null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes,
  }
}

async function grantedPermissions(userToken: string): Promise<string[]> {
  const res = await graphGet<{ data?: { permission: string; status: string }[] }>(
    'me/permissions',
    userToken,
    {},
    'Meta permissions check'
  )
  return (res.data || []).filter((p) => p.status === 'granted').map((p) => p.permission)
}

async function assertPermissions(tokens: OAuthTokens, required: string[], platformLabel: string): Promise<void> {
  let granted = tokens.scopes
  if (!granted || granted.length === 0) {
    try {
      granted = await grantedPermissions(tokens.accessToken)
    } catch {
      return // can't check; the API calls below will fail with a clear error if needed
    }
  }
  const missing = required.filter((p) => granted!.indexOf(p) === -1)
  if (missing.length > 0) {
    throw new PlatformError(
      `${platformLabel} connection is missing required permissions (${missing.join(', ')}). Please reconnect and allow all requested permissions.`
    )
  }
}

/**
 * App-scoped Facebook user id of the person who connected. Stored as
 * `metadata.fbUserId` on each account so Meta data deletion requests
 * (/api/social/meta/data-deletion, keyed by this id) can find their rows.
 * Best-effort: a failure here must not block connecting.
 */
async function facebookUserId(userToken: string): Promise<string | null> {
  try {
    const me = await graphGet<{ id?: string }>('me', userToken, { fields: 'id' }, 'Facebook user lookup')
    return me.id ? String(me.id) : null
  } catch {
    return null
  }
}

interface PageRow {
  id: string
  name: string
  access_token?: string
  tasks?: string[]
  category?: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
    profile_picture_url?: string
  }
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

function facebookPostUrl(postId: string): string {
  return `https://www.facebook.com/${postId}`
}

async function facebookPermalink(postId: string, token: string): Promise<string | null> {
  try {
    const res = await graphGet<{ permalink_url?: string }>(postId, token, { fields: 'permalink_url' }, 'Facebook permalink')
    if (!res.permalink_url) return null
    return res.permalink_url.startsWith('http') ? res.permalink_url : `https://www.facebook.com${res.permalink_url}`
  } catch {
    return null
  }
}

async function publishFacebook(req: PublishRequest): Promise<PublishResult> {
  const pageId = req.account.accountId
  const token = req.account.accessToken
  const text = req.text.trim()
  const media = await classifyMedia(req.mediaUrls)
  const videos = media.filter((m) => m.video)

  // Video post
  if (videos.length > 0) {
    if (media.length > 1) {
      throw new PlatformError('Facebook posts can contain one video, or images only — not both or several videos')
    }
    const res = await graphPost<{ id?: string; video_id?: string }>(
      `${pageId}/videos`,
      token,
      {
        file_url: videos[0].url,
        description: text || undefined,
        title: req.title?.trim() || undefined,
        published: true,
      },
      'Facebook video upload',
      { host: GRAPH_VIDEO_HOST, timeoutMs: 180_000 }
    )
    const videoId = res.id || res.video_id
    if (!videoId) throw new PlatformError('Facebook video upload failed: no video id returned')
    let permalink: string | null = null
    try {
      const info = await graphGet<{ permalink_url?: string }>(videoId, token, { fields: 'permalink_url' }, 'Facebook video')
      if (info.permalink_url) {
        permalink = info.permalink_url.startsWith('http')
          ? info.permalink_url
          : `https://www.facebook.com${info.permalink_url}`
      }
    } catch {
      // permalink is best-effort
    }
    // The feed story for a Page video uses `{pageId}_{videoId}` as its post id
    const externalId = `${pageId}_${videoId}`
    return { externalId, url: permalink || `https://www.facebook.com/${pageId}/videos/${videoId}` }
  }

  // Single photo
  if (media.length === 1) {
    const res = await graphPost<{ id?: string; post_id?: string }>(
      `${pageId}/photos`,
      token,
      { url: media[0].url, caption: text || undefined, published: true },
      'Facebook photo post',
      { timeoutMs: 60_000 }
    )
    const postId = res.post_id || (res.id ? `${pageId}_${res.id}` : '')
    if (!postId) throw new PlatformError('Facebook photo post failed: no post id returned')
    return { externalId: postId, url: (await facebookPermalink(postId, token)) || facebookPostUrl(postId) }
  }

  // Multiple photos: upload unpublished, then attach to one feed post
  const feedParams: GraphParams = { message: text || undefined }
  if (media.length > 1) {
    const photoIds: string[] = []
    for (const m of media) {
      const photo = await graphPost<{ id?: string }>(
        `${pageId}/photos`,
        token,
        { url: m.url, published: false },
        'Facebook photo upload',
        { timeoutMs: 60_000 }
      )
      if (!photo.id) throw new PlatformError('Facebook photo upload failed: no photo id returned')
      photoIds.push(photo.id)
    }
    photoIds.forEach((id, i) => {
      feedParams[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
    })
  } else if (!text) {
    throw new PlatformError('Facebook post is empty')
  }

  const res = await graphPost<{ id?: string }>(`${pageId}/feed`, token, feedParams, 'Facebook post')
  if (!res.id) throw new PlatformError('Facebook post failed: no post id returned')
  return { externalId: res.id, url: (await facebookPermalink(res.id, token)) || facebookPostUrl(res.id) }
}

/** Errors worth surfacing from metrics calls (others → just omit the metric) */
function rethrowIfFatal(e: unknown): void {
  if (e instanceof PlatformError && (e.reauthRequired || e.retryable)) throw e
}

function insightValue(
  data: { name: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[] | undefined,
  name: string
): number | undefined {
  const row = (data || []).find((d) => d.name === name)
  if (!row) return undefined
  const raw = row.total_value?.value ?? row.values?.[row.values.length - 1]?.value
  if (typeof raw === 'number') return raw
  if (raw && typeof raw === 'object') {
    // e.g. post_clicks_by_type → sum the breakdown
    return Object.values(raw as Record<string, unknown>).reduce<number>(
      (sum, v) => sum + (typeof v === 'number' ? v : 0),
      0
    )
  }
  return undefined
}

async function facebookPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
  const token = account.accessToken
  const out: PostMetricsResult = {}

  // Engagement counters (pages_read_engagement)
  try {
    const res = await graphGet<{
      reactions?: { summary?: { total_count?: number } }
      comments?: { summary?: { total_count?: number } }
      shares?: { count?: number }
    }>(
      externalId,
      token,
      { fields: 'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares' },
      'Facebook post metrics'
    )
    if (typeof res.reactions?.summary?.total_count === 'number') out.likes = res.reactions.summary.total_count
    if (typeof res.comments?.summary?.total_count === 'number') out.comments = res.comments.summary.total_count
    out.shares = typeof res.shares?.count === 'number' ? res.shares.count : 0
  } catch (e) {
    rethrowIfFatal(e)
  }

  // Insights (read_insights). post_impressions* were removed in Nov 2025;
  // post_media_view is the replacement. Query separately so one invalid
  // metric doesn't hide the other.
  const metrics: [string, keyof PostMetricsResult][] = [
    ['post_media_view', 'impressions'],
    ['post_clicks', 'clicks'],
  ]
  await Promise.all(
    metrics.map(async ([metric, key]) => {
      try {
        const res = await graphGet<{
          data?: { name: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[]
        }>(`${externalId}/insights`, token, { metric, period: 'lifetime' }, 'Facebook post insights')
        const v = insightValue(res.data, metric)
        if (typeof v === 'number') out[key] = v
      } catch (e) {
        rethrowIfFatal(e)
      }
    })
  )
  return out
}

async function facebookAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
  try {
    const res = await graphGet<{ followers_count?: number; fan_count?: number }>(
      account.accountId,
      account.accessToken,
      { fields: 'followers_count,fan_count' },
      'Facebook page metrics'
    )
    const followers = res.followers_count ?? res.fan_count
    return typeof followers === 'number' ? { followers } : {}
  } catch (e) {
    rethrowIfFatal(e)
    return {}
  }
}

export const facebookAdapter: PlatformAdapter = {
  platform: 'Facebook',

  isConfigured: isMetaConfigured,

  validate(req) {
    const text = req.text.trim()
    if (!text && req.mediaUrls.length === 0) return 'Facebook posts need text or media'
    if (text.length > FB_TEXT_LIMIT) return `Facebook posts are limited to ${FB_TEXT_LIMIT} characters`
    const videos = req.mediaUrls.filter(isVideoUrlByExtension)
    if (videos.length > 0 && req.mediaUrls.length > 1) {
      return 'Facebook posts can contain one video, or images only — not both or several videos'
    }
    if (req.mediaUrls.length > FB_MAX_PHOTOS) return `Facebook posts can contain at most ${FB_MAX_PHOTOS} images`
    return null
  },

  getAuthorizationUrl(params) {
    return buildAuthorizationUrl(params, FACEBOOK_SCOPES, 'META_FACEBOOK_CONFIG_ID')
  },

  exchangeCode(params) {
    return exchangeCodeForLongLivedToken(params, 'Facebook')
  },

  async fetchAccounts(tokens) {
    await assertPermissions(tokens, ['pages_show_list', 'pages_manage_posts'], 'Facebook')
    const pages = await graphGetAll<PageRow>(
      'me/accounts',
      tokens.accessToken,
      { fields: 'id,name,access_token,tasks,category,picture.type(large){url}', limit: 100 },
      'Facebook pages lookup'
    )
    const fbUserId = await facebookUserId(tokens.accessToken)
    const usable = pages.filter(
      (p) => p.access_token && (!p.tasks || p.tasks.indexOf('CREATE_CONTENT') !== -1)
    )
    if (usable.length === 0) {
      throw new PlatformError(
        pages.length > 0
          ? 'None of your Facebook Pages allow you to create content. Ask a Page admin for content permissions, then reconnect.'
          : 'No Facebook Pages found. Make sure you manage a Page and selected it when connecting.'
      )
    }
    return usable.map<ConnectedAccountInfo>((p) => ({
      accountId: p.id,
      accountName: p.name,
      accountType: 'page',
      avatarUrl: p.picture?.data?.url ?? null,
      metadata: { pageId: p.id, category: p.category ?? null, tasks: p.tasks ?? [], fbUserId },
      // Page tokens derived from a long-lived user token do not expire
      tokens: { accessToken: p.access_token!, refreshToken: null, expiresAt: null, scopes: tokens.scopes },
    }))
  },

  publish: publishFacebook,
  fetchPostMetrics: facebookPostMetrics,
  fetchAccountMetrics: facebookAccountMetrics,
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

interface ContainerStatus {
  id: string
  status_code?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'
  status?: string
}

/**
 * Wait until all containers are FINISHED. Bounded by `deadline`; if any is
 * still processing afterwards, throws a retryable error.
 */
async function waitForContainers(containerIds: string[], token: string, deadline: number): Promise<void> {
  const pending = containerIds.slice()
  let delay = 1500
  while (pending.length > 0) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const id = pending[i]
      const st = await graphGet<ContainerStatus>(id, token, { fields: 'status_code,status' }, 'Instagram media status')
      switch (st.status_code) {
        case 'FINISHED':
        case 'PUBLISHED':
          pending.splice(i, 1)
          break
        case 'ERROR':
          throw new PlatformError(
            `Instagram could not process the media${st.status ? `: ${st.status}` : ''}. Check the file format (JPEG images, MP4/MOV H.264 video) and size.`
          )
        case 'EXPIRED':
          throw new PlatformError('Instagram media container expired before publishing', { retryable: true })
        default:
          // IN_PROGRESS or missing → keep waiting
          break
      }
    }
    if (pending.length === 0) return
    if (Date.now() + delay > deadline) {
      throw new PlatformError('Instagram is still processing the media; will retry shortly', { retryable: true })
    }
    await sleep(delay)
    delay = Math.min(Math.round(delay * 1.6), 10_000)
  }
}

async function publishInstagram(req: PublishRequest): Promise<PublishResult> {
  const igId = req.account.accountId
  const token = req.account.accessToken
  const caption = req.text.trim()
  const media = await classifyMedia(req.mediaUrls)
  if (media.length === 0) throw new PlatformError('Instagram posts need at least one image or video')
  if (media.length > IG_MAX_MEDIA) throw new PlatformError(`Instagram posts can contain at most ${IG_MAX_MEDIA} items`)

  const deadline = Date.now() + IG_POLL_BUDGET_MS
  let creationId: string

  if (media.length === 1) {
    const m = media[0]
    const params: GraphParams = m.video
      ? { media_type: 'REELS', video_url: m.url, caption: caption || undefined, share_to_feed: true }
      : { image_url: m.url, caption: caption || undefined }
    const container = await graphPost<{ id?: string }>(`${igId}/media`, token, params, 'Instagram media upload', {
      timeoutMs: 60_000,
    })
    if (!container.id) throw new PlatformError('Instagram media upload failed: no container id returned')
    creationId = container.id
    await waitForContainers([creationId], token, deadline)
  } else {
    const children: string[] = []
    for (const m of media) {
      const params: GraphParams = m.video
        ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true }
        : { image_url: m.url, is_carousel_item: true }
      const child = await graphPost<{ id?: string }>(`${igId}/media`, token, params, 'Instagram carousel item upload', {
        timeoutMs: 60_000,
      })
      if (!child.id) throw new PlatformError('Instagram carousel item upload failed: no container id returned')
      children.push(child.id)
    }
    await waitForContainers(children, token, deadline)
    const carousel = await graphPost<{ id?: string }>(
      `${igId}/media`,
      token,
      { media_type: 'CAROUSEL', children: children.join(','), caption: caption || undefined },
      'Instagram carousel upload'
    )
    if (!carousel.id) throw new PlatformError('Instagram carousel upload failed: no container id returned')
    creationId = carousel.id
    await waitForContainers([creationId], token, deadline)
  }

  const published = await graphPost<{ id?: string }>(
    `${igId}/media_publish`,
    token,
    { creation_id: creationId },
    'Instagram publish',
    { timeoutMs: 60_000 }
  )
  if (!published.id) throw new PlatformError('Instagram publish failed: no media id returned')

  let url: string | null = null
  try {
    const info = await graphGet<{ permalink?: string }>(published.id, token, { fields: 'permalink' }, 'Instagram permalink')
    url = info.permalink ?? null
  } catch {
    url = null
  }
  return { externalId: published.id, url }
}

async function instagramPostMetrics(account: SocialAccount, externalId: string): Promise<PostMetricsResult> {
  const token = account.accessToken
  const out: PostMetricsResult = {}

  // Basic counters (instagram_basic)
  try {
    const res = await graphGet<{ like_count?: number; comments_count?: number }>(
      externalId,
      token,
      { fields: 'like_count,comments_count' },
      'Instagram media metrics'
    )
    if (typeof res.like_count === 'number') out.likes = res.like_count
    if (typeof res.comments_count === 'number') out.comments = res.comments_count
  } catch (e) {
    rethrowIfFatal(e)
  }

  // Insights (instagram_manage_insights). `impressions`/`plays`/`video_views`
  // were removed in 2025; `views` replaced them. Try the full set first, then
  // a conservative set if the API rejects a metric for this media type.
  const metricSets = ['views,reach,likes,comments,shares,saved', 'reach,likes,comments,shares,saved']
  for (const metric of metricSets) {
    try {
      const res = await graphGet<{
        data?: { name: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[]
      }>(`${externalId}/insights`, token, { metric }, 'Instagram media insights')
      const views = insightValue(res.data, 'views')
      const reach = insightValue(res.data, 'reach')
      const likes = insightValue(res.data, 'likes')
      const comments = insightValue(res.data, 'comments')
      const shares = insightValue(res.data, 'shares')
      if (typeof views === 'number') out.impressions = views
      else if (typeof reach === 'number') out.impressions = reach
      if (typeof likes === 'number') out.likes = likes
      if (typeof comments === 'number') out.comments = comments
      if (typeof shares === 'number') out.shares = shares
      break
    } catch (e) {
      rethrowIfFatal(e)
    }
  }
  return out
}

async function instagramAccountMetrics(account: SocialAccount): Promise<AccountMetricsResult> {
  try {
    const res = await graphGet<{ followers_count?: number }>(
      account.accountId,
      account.accessToken,
      { fields: 'followers_count' },
      'Instagram account metrics'
    )
    return typeof res.followers_count === 'number' ? { followers: res.followers_count } : {}
  } catch (e) {
    rethrowIfFatal(e)
    return {}
  }
}

export const instagramAdapter: PlatformAdapter = {
  platform: 'Instagram',

  isConfigured: isMetaConfigured,

  validate(req) {
    if (req.mediaUrls.length === 0) return 'Instagram posts need at least one image or video'
    if (req.mediaUrls.length > IG_MAX_MEDIA) return `Instagram posts can contain at most ${IG_MAX_MEDIA} images/videos`
    const caption = req.text.trim()
    if (caption.length > IG_CAPTION_LIMIT) return `Instagram captions are limited to ${IG_CAPTION_LIMIT} characters`
    const hashtags = caption.match(/(^|\s)#[^\s#]+/g) || []
    if (hashtags.length > IG_MAX_HASHTAGS) return `Instagram captions can contain at most ${IG_MAX_HASHTAGS} hashtags`
    const mentions = caption.match(/(^|\s)@[\w.]+/g) || []
    if (mentions.length > IG_MAX_MENTIONS) return `Instagram captions can mention at most ${IG_MAX_MENTIONS} accounts`
    const nonJpeg = req.mediaUrls.find((u) => NON_JPEG_IMAGE_EXT.test(urlPath(u)))
    if (nonJpeg) return 'Instagram only accepts JPEG images — convert PNG/GIF/WebP images to JPEG'
    return null
  },

  getAuthorizationUrl(params) {
    return buildAuthorizationUrl(params, INSTAGRAM_SCOPES, 'META_INSTAGRAM_CONFIG_ID')
  },

  exchangeCode(params) {
    return exchangeCodeForLongLivedToken(params, 'Instagram')
  },

  async fetchAccounts(tokens) {
    await assertPermissions(tokens, ['instagram_basic', 'instagram_content_publish', 'pages_show_list'], 'Instagram')
    const pages = await graphGetAll<PageRow>(
      'me/accounts',
      tokens.accessToken,
      {
        fields: 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
        limit: 100,
      },
      'Instagram accounts lookup'
    )
    const fbUserId = await facebookUserId(tokens.accessToken)
    const accounts: ConnectedAccountInfo[] = []
    const seen: Record<string, true> = {}
    for (const p of pages) {
      const ig = p.instagram_business_account
      if (!ig?.id || !p.access_token || seen[ig.id]) continue
      seen[ig.id] = true
      accounts.push({
        accountId: ig.id,
        accountName: ig.username ? `@${ig.username}` : ig.name || p.name,
        accountType: 'instagram_business',
        avatarUrl: ig.profile_picture_url ?? null,
        metadata: { pageId: p.id, pageName: p.name, username: ig.username ?? null, fbUserId },
        tokens: { accessToken: p.access_token, refreshToken: null, expiresAt: null, scopes: tokens.scopes },
      })
    }
    if (accounts.length === 0) {
      throw new PlatformError(
        'No Instagram professional account found. Switch your Instagram account to Business or Creator, link it to a Facebook Page you manage, and select that Page when connecting.'
      )
    }
    return accounts
  },

  publish: publishInstagram,
  fetchPostMetrics: instagramPostMetrics,
  fetchAccountMetrics: instagramAccountMetrics,
}
