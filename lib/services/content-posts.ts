import { createClient } from '@/lib/supabase/server'
import { requireUserId } from './auth'
import { PLATFORMS } from '@/lib/platforms'
import type { PlatformPost } from '@/models/content'
import { ValidationError } from '@/lib/api/error'

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'

export type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'needs_manual'

export interface ContentPost {
  id: string
  user_id: string
  title: string | null
  description: string | null
  content: string
  media_urls: string[] | null
  content_type: string
  status: PostStatus
  published_at: string | null
  scheduled_for: string | null
  tone: string
  language: string
  generated_by_ai: boolean
  credits_used: number
  platforms: string[]
  platform_variants: Record<string, PlatformPost>
  created_at: string
  updated_at: string
}

export interface PostTarget {
  id: string
  post_id: string
  platform: string
  status: TargetStatus
  published_at: string | null
  external_url: string | null
  error_message: string | null
  /** Connected account used for auto-publishing (null when marked manually) */
  social_account_id: string | null
  /** Provider's post id, set when auto-published */
  external_id: string | null
  attempts: number
  /** When the publisher will retry a failed target (null = no retry) */
  next_attempt_at: string | null
  last_attempt_at: string | null
}

export interface PostMetric {
  platform: string
  engagement_type: string
  count: number
  recorded_at: string
}

export interface PostWithDetails extends ContentPost {
  targets: PostTarget[]
  metrics: PostMetric[]
}

export const METRIC_TYPES = ['impressions', 'likes', 'comments', 'shares', 'clicks'] as const
export type MetricType = (typeof METRIC_TYPES)[number]

const MAX_CONTENT = 70_000

function isPlatform(p: unknown): p is string {
  return typeof p === 'string' && (PLATFORMS as readonly string[]).includes(p)
}

function sanitizeVariants(input: unknown): Record<string, PlatformPost> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Record<string, PlatformPost> = {}
  for (const [platform, raw] of Object.entries(input as Record<string, any>)) {
    if (!isPlatform(platform) || !raw || typeof raw !== 'object') continue
    const str = (v: unknown, max = 10_000) => (typeof v === 'string' ? v.slice(0, max) : undefined)
    out[platform] = {
      post: str(raw.post, MAX_CONTENT),
      caption: str(raw.caption, MAX_CONTENT),
      call_to_action: str(raw.call_to_action, 1000),
      image_suggestion: str(raw.image_suggestion, 2000),
      video_suggestion: str(raw.video_suggestion, 2000),
      title: str(raw.title, 500),
      description: str(raw.description, 5000),
      hashtags: Array.isArray(raw.hashtags)
        ? raw.hashtags.map((h: unknown) => String(h).replace(/^#+/, '').trim()).filter(Boolean).slice(0, 50)
        : [],
      emojis: Array.isArray(raw.emojis) ? raw.emojis.map(String).slice(0, 20) : undefined,
    }
  }
  return out
}

function sanitizeMediaUrls(input: unknown): string[] | undefined {
  if (input === undefined || input === null) return undefined
  if (!Array.isArray(input)) throw new ValidationError('media_urls must be an array')
  const urls = input.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u))
  if (urls.length > 10) throw new ValidationError('A post can have at most 10 media files')
  return urls
}

/** Validates an ISO date for scheduling; must be in the future */
function parseSchedule(input: unknown): string | null {
  if (input === undefined || input === null || input === '') return null
  if (typeof input !== 'string') throw new ValidationError('scheduled_for must be an ISO date string')
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) throw new ValidationError('scheduled_for is not a valid date')
  if (date.getTime() < Date.now() - 60_000) {
    throw new ValidationError('Scheduled time must be in the future')
  }
  return date.toISOString()
}

export interface CreatePostInput {
  content?: string
  title?: string
  description?: string
  media_urls?: unknown
  tone?: string
  language?: string
  scheduled_for?: unknown
  generated_by_ai?: boolean
  platforms?: unknown
  platform_variants?: unknown
}

/**
 * Create a post. If per-platform variants are supplied, `content` defaults
 * to the first platform's text.
 */
export async function createPost(input: CreatePostInput): Promise<ContentPost> {
  const supabase = createClient()
  const userId = await requireUserId()

  const variants = sanitizeVariants(input.platform_variants)
  const platforms = Array.isArray(input.platforms)
    ? Array.from(new Set(input.platforms.filter(isPlatform)))
    : Object.keys(variants)

  const firstVariant = platforms.map((p) => variants[p]).find(Boolean)
  const content = (input.content || firstVariant?.post || firstVariant?.caption || '').trim()

  if (!content) throw new ValidationError('Content is required')
  if (content.length > MAX_CONTENT) throw new ValidationError('Content is too long')

  const scheduledFor = parseSchedule(input.scheduled_for)

  const { data, error } = await supabase
    .from('content_posts')
    .insert({
      user_id: userId,
      content,
      title: input.title?.slice(0, 300) || null,
      description: input.description?.slice(0, 2000) || null,
      media_urls: sanitizeMediaUrls(input.media_urls) ?? null,
      content_type: 'text',
      tone: (input.tone || 'professional').toLowerCase().slice(0, 50),
      language: (input.language || 'en').slice(0, 10),
      scheduled_for: scheduledFor,
      generated_by_ai: Boolean(input.generated_by_ai),
      platforms,
      platform_variants: variants,
      status: scheduledFor ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (error) throw error
  return data as ContentPost
}

/**
 * List the current user's posts, newest first.
 */
export async function getUserPosts(options: {
  status?: string
  limit?: number
  offset?: number
  search?: string
} = {}): Promise<ContentPost[]> {
  const supabase = createClient()
  const userId = await requireUserId()

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200)
  const offset = Math.max(options.offset ?? 0, 0)

  let query = supabase.from('content_posts').select('*').eq('user_id', userId)

  if (options.status) query = query.eq('status', options.status)

  const search = options.search?.trim()
  if (search) {
    // Escape PostgREST filter syntax and LIKE wildcards
    const term = search.slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')
    query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data as ContentPost[]
}

/**
 * One post with its per-platform publish status and recorded metrics.
 */
export async function getPost(postId: string): Promise<PostWithDetails | null> {
  const supabase = createClient()
  const userId = await requireUserId()

  const { data: post, error } = await supabase
    .from('content_posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!post) return null

  const [{ data: targets }, { data: metrics }] = await Promise.all([
    supabase
      .from('post_targets')
      .select(
        'id, post_id, platform, status, published_at, external_url, error_message, social_account_id, external_id, attempts, next_attempt_at, last_attempt_at'
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true }),
    supabase
      .from('post_analytics')
      .select('platform, engagement_type, count, recorded_at')
      .eq('post_id', postId),
  ])

  return {
    ...(post as ContentPost),
    targets: (targets || []) as PostTarget[],
    metrics: (metrics || []) as PostMetric[],
  }
}

const POST_BUSY_MESSAGE = 'This post is being published right now. Try again in a minute.'

export interface UpdatePostInput {
  title?: string | null
  description?: string | null
  content?: string
  media_urls?: unknown
  scheduled_for?: unknown
  platforms?: unknown
  platform_variants?: unknown
  status?: 'draft'
}

/**
 * Update the editable fields of a post. Setting `scheduled_for` schedules
 * the post; clearing it (null) moves it back to draft. Published posts keep
 * their status.
 */
export async function updatePost(postId: string, input: UpdatePostInput): Promise<ContentPost> {
  const supabase = createClient()
  const userId = await requireUserId()

  const { data: existing, error: loadError } = await supabase
    .from('content_posts')
    .select('status')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (loadError) throw loadError
  if (!existing) throw new Error('Post not found')
  if (existing.status === 'publishing') throw new ValidationError(POST_BUSY_MESSAGE)

  const updates: Record<string, unknown> = {}
  let resetTargets = false

  if (input.title !== undefined) updates.title = input.title ? String(input.title).slice(0, 300) : null
  if (input.description !== undefined) {
    updates.description = input.description ? String(input.description).slice(0, 2000) : null
  }
  if (input.content !== undefined) {
    const content = String(input.content).trim()
    if (!content) throw new ValidationError('Content cannot be empty')
    if (content.length > MAX_CONTENT) throw new ValidationError('Content is too long')
    updates.content = content
  }
  if (input.media_urls !== undefined) updates.media_urls = sanitizeMediaUrls(input.media_urls) ?? null
  if (input.platform_variants !== undefined) {
    updates.platform_variants = sanitizeVariants(input.platform_variants)
  }
  if (input.platforms !== undefined) {
    if (!Array.isArray(input.platforms)) throw new ValidationError('platforms must be an array')
    updates.platforms = Array.from(new Set(input.platforms.filter(isPlatform)))
  }

  if (input.scheduled_for !== undefined) {
    const scheduledFor = parseSchedule(input.scheduled_for)
    updates.scheduled_for = scheduledFor
    if (existing.status !== 'published') {
      if (scheduledFor) {
        // (Re)scheduling, including a failed or partially published post:
        // the platforms not yet published get a fresh set of attempts.
        updates.status = 'scheduled'
        resetTargets = true
      } else if (existing.status !== 'partially_published') {
        updates.status = 'draft'
      }
    }
  } else if (input.status === 'draft' && (existing.status === 'scheduled' || existing.status === 'failed')) {
    updates.status = 'draft'
    updates.scheduled_for = null
  }

  if (Object.keys(updates).length === 0) throw new ValidationError('Nothing to update')

  if (resetTargets || updates.status === 'draft') {
    // Pending retries belong to the old schedule; a draft is never retried.
    // Done first so the publisher never sees the new schedule with old state.
    const { error: targetError } = await supabase
      .from('post_targets')
      .update(
        resetTargets
          ? { status: 'pending', attempts: 0, next_attempt_at: null, error_message: null }
          : { next_attempt_at: null }
      )
      .eq('post_id', postId)
      .in('status', resetTargets ? ['failed', 'needs_manual', 'pending'] : ['failed'])
    if (targetError) throw targetError
  }

  // Guard against the publisher claiming the post in the meantime
  const { data, error } = await supabase
    .from('content_posts')
    .update(updates)
    .eq('id', postId)
    .eq('user_id', userId)
    .neq('status', 'publishing')
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) throw new ValidationError(POST_BUSY_MESSAGE)

  return data as ContentPost
}

/**
 * Record that the post was published on the given platforms (optionally with
 * the live post URL). Marks the post itself as published.
 */
export async function markPublished(
  postId: string,
  entries: { platform: string; url?: string | null }[]
): Promise<PostWithDetails> {
  const supabase = createClient()
  const userId = await requireUserId()

  const valid = entries.filter((e) => isPlatform(e.platform))
  if (valid.length === 0) throw new ValidationError('Choose at least one platform')

  for (const e of valid) {
    if (e.url && !/^https?:\/\//.test(e.url)) {
      throw new ValidationError(`Invalid URL for ${e.platform}`)
    }
  }

  const { data: post, error: postError } = await supabase
    .from('content_posts')
    .select('id, status')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (postError) throw postError
  if (!post) throw new Error('Post not found')
  if (post.status === 'publishing') throw new ValidationError(POST_BUSY_MESSAGE)

  const now = new Date().toISOString()
  const { error: targetError } = await supabase.from('post_targets').upsert(
    valid.map((e) => ({
      post_id: postId,
      platform: e.platform,
      status: 'published',
      published_at: now,
      external_url: e.url || null,
      error_message: null,
      next_attempt_at: null,
    })),
    { onConflict: 'post_id,platform' }
  )
  if (targetError) throw targetError

  if (post.status !== 'published') {
    const { error } = await supabase
      .from('content_posts')
      .update({ status: 'published', published_at: now })
      .eq('id', postId)
      .eq('user_id', userId)
      .neq('status', 'publishing')
    if (error) throw error
  }

  const updated = await getPost(postId)
  if (!updated) throw new Error('Post not found')
  return updated
}

/**
 * Save the latest engagement numbers for a post on one platform.
 */
export async function recordMetrics(
  postId: string,
  platform: string,
  metrics: Partial<Record<MetricType, unknown>>
): Promise<void> {
  const supabase = createClient()
  const userId = await requireUserId()

  if (!isPlatform(platform)) throw new ValidationError('Unknown platform')

  const { data: post, error: postError } = await supabase
    .from('content_posts')
    .select('id')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (postError) throw postError
  if (!post) throw new Error('Post not found')

  const now = new Date().toISOString()
  const rows = METRIC_TYPES.filter((m) => metrics[m] !== undefined && metrics[m] !== '').map((m) => {
    const n = Number(metrics[m])
    if (!Number.isInteger(n) || n < 0 || n > 2_000_000_000) {
      throw new ValidationError(`${m} must be a whole number of 0 or more`)
    }
    return { post_id: postId, platform, engagement_type: m, count: n, recorded_at: now }
  })

  if (rows.length === 0) throw new ValidationError('Enter at least one metric')

  const { error } = await supabase
    .from('post_analytics')
    .upsert(rows, { onConflict: 'post_id,platform,engagement_type' })

  if (error) throw error
}

/**
 * Delete a post (its targets and metrics cascade).
 */
export async function deletePost(postId: string): Promise<void> {
  const supabase = createClient()
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('content_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId)
    .neq('status', 'publishing')
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) {
    const { data: existing } = await supabase
      .from('content_posts')
      .select('status')
      .eq('id', postId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing?.status === 'publishing') throw new ValidationError(POST_BUSY_MESSAGE)
    throw new Error('Post not found')
  }
}
