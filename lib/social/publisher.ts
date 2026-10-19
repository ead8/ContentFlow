import { mediaUrlProblem } from './media-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLATFORMS, composeVariantText, platformLabel, type Platform } from '@/lib/platforms'
import { ValidationError } from '@/lib/api/error'
import { notify } from '@/lib/notifications'
import type { PlatformPost } from '@/models/content'
import { getAdapter } from './registry'
import { PlatformError, type SocialAccount } from './types'
import { getPublishingAccount, markAccountStatus } from './accounts'

/**
 * Background publisher. Server-only: uses the service-role client.
 *
 * Posts are claimed atomically (claim_due_posts() for the cron, a guarded
 * UPDATE for "Publish now"), then each of the post's platforms is published
 * through the user's connected account. A target that is already
 * 'published' (or has a provider post id) is never published again.
 */

type Admin = ReturnType<typeof createAdminClient>

/** Automatic attempts per platform before giving up */
export const MAX_PUBLISH_ATTEMPTS = 3
/** A 'publishing' claim older than this is considered abandoned */
const STALE_CLAIM_MS = 15 * 60_000
/** Posts published in parallel by one cron run */
const CYCLE_CONCURRENCY = 3
/** Stop starting new posts after this long; in-flight uploads get the rest of maxDuration (300 s) */
const CYCLE_BUDGET_MS = 180_000

const TARGET_COLUMNS =
  'id, post_id, platform, status, social_account_id, external_id, external_url, attempts, next_attempt_at, last_attempt_at, published_at, error_message'

type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'needs_manual'

/** The content_posts row as returned by claim_due_posts() */
export interface ClaimedPost {
  id: string
  user_id: string
  title: string | null
  content: string
  media_urls: string[] | null
  platforms: string[] | null
  platform_variants: Record<string, PlatformPost> | null
  status: string
  published_at: string | null
  scheduled_for: string | null
}

interface TargetRow {
  id?: string
  post_id: string
  platform: string
  status: TargetStatus
  social_account_id: string | null
  external_id: string | null
  external_url: string | null
  attempts: number
  next_attempt_at: string | null
  last_attempt_at?: string | null
  published_at: string | null
  error_message: string | null
}

type TargetResult =
  | { platform: Platform; kind: 'published'; url: string | null }
  | { platform: Platform; kind: 'retry'; error: string; retryAt: string }
  | { platform: Platform; kind: 'failed'; error: string }
  | { platform: Platform; kind: 'reauth'; error: string }
  | { platform: Platform; kind: 'needs_manual'; error: string }

export interface PublishOutcome {
  postId: string
  status: 'published' | 'partially_published' | 'failed' | 'scheduled'
  /** Platforms published in this run */
  published: Platform[]
  /** Platforms that failed in this run (retryAt set when a retry is scheduled) */
  failed: { platform: Platform; error: string; retryAt: string | null }[]
  /** Platforms with no connected account */
  needsManual: Platform[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlatform(p: unknown): p is Platform {
  return typeof p === 'string' && (PLATFORMS as readonly string[]).includes(p)
}

/** The platforms a post goes to: post.platforms, else its variant keys */
function postPlatformList(post: {
  platforms?: string[] | null
  platform_variants?: Record<string, unknown> | null
}): Platform[] {
  const list =
    post.platforms && post.platforms.length > 0
      ? post.platforms
      : Object.keys(post.platform_variants || {})
  return Array.from(new Set(list.filter(isPlatform)))
}

function retryDelayMs(attempts: number): number {
  return Math.pow(2, attempts) * 60_000
}

function labels(platforms: Platform[]): string {
  const names = platforms.map(platformLabel)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function postName(post: ClaimedPost): string {
  const name = (post.title || post.content || 'Your post').replace(/\s+/g, ' ').trim()
  return name.length > 60 ? `${name.slice(0, 57)}...` : name
}

function errorText(err: unknown, platform: Platform): string {
  if (err instanceof PlatformError) return err.message.slice(0, 500)
  // Internal errors (database, configuration) are logged, never shown/emailed
  console.error(`publisher: ${platformLabel(platform)} internal error:`, err)
  return `${platformLabel(platform)} publish failed because of a temporary problem on our side. Please try again.`
}

/** Failure after the create request was sent: the post may already be live */
function ambiguousError(platform: Platform): PlatformError {
  const label = platformLabel(platform)
  return new PlatformError(
    `Publishing to ${label} was interrupted and the post may already be live. Check your ${label} profile; ` +
      `use Retry only if it isn't there, or mark it as published.`
  )
}

async function upsertTarget(
  admin: Admin,
  postId: string,
  platform: Platform,
  fields: Partial<Omit<TargetRow, 'post_id' | 'platform'>>
): Promise<void> {
  const { error } = await admin
    .from('post_targets')
    .upsert({ post_id: postId, platform, ...fields }, { onConflict: 'post_id,platform' })
  if (error) throw error
}

/** Run `worker` over `items` with at most `concurrency` in flight */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

// ---------------------------------------------------------------------------
// One platform
// ---------------------------------------------------------------------------

async function publishTarget(
  admin: Admin,
  post: ClaimedPost,
  platform: Platform,
  existing: TargetRow | undefined,
  manual: boolean
): Promise<TargetResult> {
  const label = platformLabel(platform)
  const adapter = getAdapter(platform)
  const variant = (post.platform_variants || {})[platform]
  const text = (variant ? composeVariantText(variant) : '') || post.content
  const mediaUrls = post.media_urls ?? []
  const title = variant?.title || post.title || null
  // "Publish now" / "Retry" starts a fresh round of automatic attempts
  const priorAttempts = manual ? 0 : existing?.attempts ?? 0

  // 1. The account to publish with
  let account: SocialAccount | null = null
  try {
    account = adapter ? await getPublishingAccount(post.user_id, platform) : null
  } catch (err) {
    const error = errorText(err, platform)
    if (err instanceof PlatformError && err.reauthRequired) {
      // accounts.ts already marked the account expired
      await upsertTarget(admin, post.id, platform, {
        status: 'failed',
        error_message: error,
        next_attempt_at: null,
        last_attempt_at: new Date().toISOString(),
      })
      return { platform, kind: 'reauth', error }
    }
    return failTarget(admin, post, platform, priorAttempts + 1, err, null)
  }

  if (!account) {
    const error = `No connected ${label} account. Connect one in Settings, or publish it yourself and mark it as published.`
    await upsertTarget(admin, post.id, platform, {
      status: 'needs_manual',
      error_message: error,
      next_attempt_at: null,
    })
    return { platform, kind: 'needs_manual', error }
  }

  // 2. Can this post go to this platform at all? Media must be the owner's
  //    own uploads (the server downloads it; see lib/social/media-url.ts).
  const mediaProblem = mediaUrls.map((u) => mediaUrlProblem(u, post.user_id)).find(Boolean) ?? null
  const invalid = mediaProblem ?? adapter.validate?.({ text, mediaUrls, title }) ?? null
  if (invalid) {
    await upsertTarget(admin, post.id, platform, {
      status: 'failed',
      social_account_id: account.id,
      error_message: invalid,
      next_attempt_at: null,
    })
    return { platform, kind: 'failed', error: invalid }
  }

  // 3. Record the attempt before calling the provider
  const attempts = priorAttempts + 1
  await upsertTarget(admin, post.id, platform, {
    status: 'publishing',
    social_account_id: account.id,
    attempts,
    last_attempt_at: new Date().toISOString(),
    next_attempt_at: null,
    error_message: null,
  })

  // 4. Publish
  let result: { externalId: string; url: string | null }
  let committed = false
  try {
    result = await adapter.publish({
      account,
      text,
      mediaUrls,
      title,
      commit: () => {
        committed = true
      },
    })
  } catch (rawErr) {
    let err = rawErr
    // After the create request went out, only an explicit refusal proves no
    // post was made (rate limit, auth, validation). Anything else, including
    // timeouts, network errors, 5xx and unparseable responses, is ambiguous,
    // and an automatic retry could double-post.
    if (committed) {
      const provenNotCreated =
        err instanceof PlatformError &&
        (err.reauthRequired || err.status === 429 || (!err.retryable && (err.status ?? 0) >= 400 && (err.status ?? 0) < 500))
      if (!provenNotCreated) {
        console.error(`publisher: post ${post.id} on ${label} failed after the create request:`, rawErr)
        err = ambiguousError(platform)
      }
    }
    if (err instanceof PlatformError && err.reauthRequired) {
      const error = errorText(err, platform)
      try {
        await markAccountStatus(account.id, 'expired', error)
      } catch (markError) {
        console.error(`publisher: could not mark ${label} account expired:`, markError)
      }
      await upsertTarget(admin, post.id, platform, {
        status: 'failed',
        error_message: error,
        next_attempt_at: null,
      })
      return { platform, kind: 'reauth', error }
    }
    return failTarget(admin, post, platform, attempts, err, account.id)
  }

  // 5. Save the result. The post is live now, so retry the write rather than
  // ever scheduling another publish for it.
  const fields = {
    status: 'published' as const,
    social_account_id: account.id,
    external_id: result.externalId,
    external_url: result.url,
    published_at: new Date().toISOString(),
    error_message: null,
    next_attempt_at: null,
  }
  for (let i = 0; i < 3; i++) {
    try {
      await upsertTarget(admin, post.id, platform, fields)
      break
    } catch (saveError) {
      console.error(
        `publisher: post ${post.id} is live on ${label} (${result.externalId}) but saving failed (try ${i + 1}):`,
        saveError
      )
      if (i < 2) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  return { platform, kind: 'published', url: result.url }
}

/** Record a failed attempt; retryable errors get a backoff retry */
async function failTarget(
  admin: Admin,
  post: ClaimedPost,
  platform: Platform,
  attempts: number,
  err: unknown,
  accountId: string | null
): Promise<TargetResult> {
  const error = errorText(err, platform)
  // Unknown errors (network failures, provider hiccups) are treated as transient
  const retryable = err instanceof PlatformError ? err.retryable : true
  const retryAt =
    retryable && attempts < MAX_PUBLISH_ATTEMPTS
      ? new Date(Date.now() + retryDelayMs(attempts)).toISOString()
      : null

  if (!(err instanceof PlatformError)) {
    console.error(`publisher: post ${post.id} on ${platformLabel(platform)} failed:`, err)
  }

  await upsertTarget(admin, post.id, platform, {
    status: 'failed',
    attempts,
    error_message: error,
    next_attempt_at: retryAt,
    ...(accountId ? { social_account_id: accountId } : {}),
  })

  return retryAt
    ? { platform, kind: 'retry', error, retryAt }
    : { platform, kind: 'failed', error }
}

// ---------------------------------------------------------------------------
// One post
// ---------------------------------------------------------------------------

/**
 * Publish a post that has already been claimed (status 'publishing').
 *
 * Without `onlyPlatforms` (cron): publishes targets that are new, pending or
 * due for a retry; targets left in 'publishing' by a crashed run are marked
 * failed for the user to check (never re-sent automatically). With `onlyPlatforms`
 * ("Publish now" / "Retry"): publishes those platforms unless already
 * published, starting a fresh round of attempts.
 */
export async function publishClaimedPost(
  post: ClaimedPost,
  onlyPlatforms?: string[]
): Promise<PublishOutcome> {
  const admin = createAdminClient()
  const manual = onlyPlatforms !== undefined
  const platforms = postPlatformList(post)

  const { data: rows, error } = await admin
    .from('post_targets')
    .select(TARGET_COLUMNS)
    .eq('post_id', post.id)
  if (error) throw error

  const targets = new Map<string, TargetRow>()
  for (const row of (rows || []) as TargetRow[]) targets.set(row.platform, row)

  // A provider post id means it went out even if the status write was lost
  for (const t of Array.from(targets.values())) {
    if (t.external_id && t.status !== 'published' && isPlatform(t.platform)) {
      await upsertTarget(admin, post.id, t.platform, {
        status: 'published',
        error_message: null,
        next_attempt_at: null,
        published_at: t.published_at ?? new Date().toISOString(),
      })
      t.status = 'published'
    }
  }

  // A target left in 'publishing' means an earlier run died mid-request: the
  // provider may already have the post. Never re-send it automatically (a
  // duplicate on a real account is worse than a missed one); ask the user.
  // A manual retry of one platform resolves the others' interrupted rows too,
  // so the post isn't stuck with a 'publishing' target nobody will pick up.
  const interrupted: TargetResult[] = []
  {
    for (const t of Array.from(targets.values())) {
      if (t.status !== 'publishing' || !isPlatform(t.platform)) continue
      if (manual && onlyPlatforms!.includes(t.platform)) continue
      const label = platformLabel(t.platform)
      await upsertTarget(admin, post.id, t.platform, {
        status: 'failed',
        error_message: `Publishing to ${label} was interrupted. Check ${label}: if the post isn't there, press Retry.`,
        next_attempt_at: null,
      })
      t.status = 'failed'
      t.next_attempt_at = null
      interrupted.push({
        platform: t.platform,
        kind: 'failed',
        error: `Publishing to ${label} was interrupted. Check ${label}: if the post isn't there, press Retry.`,
      })
    }
  }

  const now = Date.now()
  const toPublish = platforms.filter((p) => {
    if (manual && !onlyPlatforms!.includes(p)) return false
    const t = targets.get(p)
    if (!t) return true
    if (t.status === 'published' || t.external_id) return false
    if (manual) return true
    switch (t.status) {
      case 'pending':
        return true
      case 'failed':
        return t.next_attempt_at !== null && Date.parse(t.next_attempt_at) <= now + 5_000
      default:
        // needs_manual and permanent failures wait for the user
        return false
    }
  })

  // Platforms one at a time, so a slow upload never runs twice in parallel
  const results: TargetResult[] = [...interrupted]
  for (const platform of toPublish) {
    let result: TargetResult
    try {
      result = await publishTarget(admin, post, platform, targets.get(platform), manual)
    } catch (err) {
      // Database trouble while recording the attempt (the provider was not
      // called, or the failure happened before it was): retry later.
      console.error(`publisher: post ${post.id} on ${platform}:`, err)
      const attempts = (manual ? 0 : targets.get(platform)?.attempts ?? 0) + 1
      // If this write fails too, recoverPost() takes over
      result = await failTarget(admin, post, platform, attempts, err, null)
    }
    results.push(result)
  }

  // Final state of every platform: this run's results over the stored rows
  const finalStatus = new Map<Platform, TargetStatus>()
  for (const p of platforms) finalStatus.set(p, targets.get(p)?.status ?? 'pending')
  let retryPending = platforms.some((p) => {
    const t = targets.get(p)
    return t?.status === 'failed' && t.next_attempt_at !== null && !toPublish.includes(p)
  })
  for (const r of results) {
    finalStatus.set(
      r.platform,
      r.kind === 'published' ? 'published' : r.kind === 'needs_manual' ? 'needs_manual' : 'failed'
    )
    if (r.kind === 'retry') retryPending = true
  }

  const publishedCount = platforms.filter((p) => finalStatus.get(p) === 'published').length
  const unattempted = platforms.some((p) => finalStatus.get(p) === 'pending')
  const scheduledLater =
    post.scheduled_for !== null && Date.parse(post.scheduled_for) > Date.now()

  let status: PublishOutcome['status']
  if (platforms.length > 0 && publishedCount === platforms.length) status = 'published'
  else if (unattempted && scheduledLater) status = 'scheduled' // the rest go out on schedule
  else if (publishedCount > 0) status = 'partially_published'
  else status = 'failed'

  const nowIso = new Date().toISOString()
  const postUpdate: Record<string, unknown> = {
    status,
    publish_claimed_at: null,
    updated_at: nowIso,
  }
  if (publishedCount > 0 && !post.published_at) postUpdate.published_at = nowIso

  const { error: postError } = await admin.from('content_posts').update(postUpdate).eq('id', post.id)
  if (postError) throw postError

  // Keep calendar entries for this post in step
  const calendarStatus =
    status === 'published' || status === 'partially_published'
      ? 'published'
      : status === 'failed' && !retryPending
        ? 'failed'
        : null
  if (calendarStatus) {
    const { error: calError } = await admin
      .from('calendar_events')
      .update({ status: calendarStatus, updated_at: nowIso })
      .eq('post_id', post.id)
    if (calError) console.error(`publisher: calendar sync for post ${post.id} failed:`, calError.message)
  }

  const outcome: PublishOutcome = {
    postId: post.id,
    status,
    published: results.filter((r) => r.kind === 'published').map((r) => r.platform),
    failed: results
      .filter((r): r is Extract<TargetResult, { error: string }> =>
        r.kind === 'retry' || r.kind === 'failed' || r.kind === 'reauth'
      )
      .map((r) => ({ platform: r.platform, error: r.error, retryAt: r.kind === 'retry' ? r.retryAt : null })),
    needsManual: results.filter((r) => r.kind === 'needs_manual').map((r) => r.platform),
  }

  if (platforms.length === 0) {
    outcome.failed = []
    await notify(post.user_id, {
      type: 'publish_failed',
      title: `Couldn't publish "${postName(post)}"`,
      body: 'This post has no platforms selected. Choose at least one platform and schedule it again.',
      link: `/posts/${post.id}`,
      email: !manual,
    })
  }

  await sendNotifications(post, results, manual)
  return outcome
}

/** One notification per outcome for this run; retries stay silent */
async function sendNotifications(post: ClaimedPost, results: TargetResult[], manual: boolean) {
  const link = `/posts/${post.id}`
  const name = postName(post)
  // The user is watching the result of "Publish now", so skip emails then
  const email = !manual

  const published = results.filter((r) => r.kind === 'published').map((r) => r.platform)
  const needsManual = results.filter((r) => r.kind === 'needs_manual').map((r) => r.platform)
  const reauth = results.filter((r): r is Extract<TargetResult, { kind: 'reauth' }> => r.kind === 'reauth')
  const failed = results.filter((r): r is Extract<TargetResult, { kind: 'failed' }> => r.kind === 'failed')

  if (published.length > 0 && !manual) {
    await notify(post.user_id, {
      type: 'publish_succeeded',
      title: `Published to ${labels(published)}`,
      body: `"${name}" is now live on ${labels(published)}.`,
      link,
    })
  }

  if (needsManual.length > 0) {
    await notify(post.user_id, {
      type: 'needs_manual',
      title: `"${name}" needs to be published manually`,
      body: `There is no connected ${labels(needsManual)} account. Connect one in Settings and retry, or publish the post yourself and mark it as published.`,
      link,
      email,
    })
  }

  if (reauth.length > 0) {
    const platforms = reauth.map((r) => r.platform)
    await notify(post.user_id, {
      type: 'account_expired',
      title: `Reconnect your ${labels(platforms)} account`,
      body: `We couldn't publish "${name}" because the connection to ${labels(platforms)} has expired. Reconnect it in Settings, then retry the post.`,
      link,
      email,
    })
  }

  if (failed.length > 0) {
    await notify(post.user_id, {
      type: 'publish_failed',
      title: `Couldn't publish "${name}" to ${labels(failed.map((r) => r.platform))}`,
      body: failed.map((r) => `${platformLabel(r.platform)}: ${r.error}`).join('\n\n'),
      link,
      email,
    })
  }
}

/**
 * Last resort when publishing a post throws unexpectedly: never leave it in
 * 'publishing'. Interrupted platforms fail with a backoff retry (bounded by
 * MAX_PUBLISH_ATTEMPTS).
 */
async function recoverPost(post: ClaimedPost, cause: unknown, manual: boolean): Promise<PublishOutcome> {
  console.error(`publisher: unexpected error publishing post ${post.id}:`, cause)
  const platforms = postPlatformList(post)
  const outcome: PublishOutcome = {
    postId: post.id,
    status: 'failed',
    published: [],
    failed: [],
    needsManual: [],
  }

  try {
    const admin = createAdminClient()
    const { data: rows } = await admin.from('post_targets').select(TARGET_COLUMNS).eq('post_id', post.id)
    const targets = new Map<string, TargetRow>()
    for (const row of (rows || []) as TargetRow[]) targets.set(row.platform, row)

    const error = 'Publishing was interrupted by an unexpected error.'
    let retryPending = false
    let publishedCount = 0

    for (const p of platforms) {
      const t = targets.get(p)
      if (t?.status === 'published' || t?.external_id) {
        publishedCount++
        continue
      }
      if (t?.status === 'needs_manual') continue
      if (t?.status === 'failed') {
        if (t.next_attempt_at) retryPending = true
        continue
      }
      // Interrupted mid-publish: the provider may already have the post, so
      // the user decides (no automatic retry). Missing/pending: retry later.
      const midPublish = t?.status === 'publishing'
      const attempts = midPublish ? t.attempts : (t?.attempts ?? 0) + 1
      const retryAt =
        !midPublish && attempts < MAX_PUBLISH_ATTEMPTS
          ? new Date(Date.now() + retryDelayMs(Math.max(attempts, 1))).toISOString()
          : null
      const message = midPublish
        ? `Publishing to ${platformLabel(p)} was interrupted. Check ${platformLabel(p)}: if the post isn't there, press Retry.`
        : error
      if (retryAt) retryPending = true
      try {
        await upsertTarget(admin, post.id, p, {
          status: 'failed',
          attempts,
          error_message: message,
          next_attempt_at: retryAt,
        })
        outcome.failed.push({ platform: p, error: message, retryAt })
      } catch (e) {
        console.error(`publisher: recovery for post ${post.id} on ${p} failed:`, e)
      }
    }

    outcome.status =
      platforms.length > 0 && publishedCount === platforms.length
        ? 'published'
        : publishedCount > 0
          ? 'partially_published'
          : 'failed'

    const { error: postError } = await admin
      .from('content_posts')
      .update({ status: outcome.status, publish_claimed_at: null, updated_at: new Date().toISOString() })
      .eq('id', post.id)
    if (postError) throw postError

    if (!retryPending && outcome.status !== 'published') {
      await notify(post.user_id, {
        type: 'publish_failed',
        title: `Couldn't publish "${postName(post)}"`,
        body: `${error} Please try again from the post page.`,
        link: `/posts/${post.id}`,
        email: !manual,
      })
    }
  } catch (e) {
    // The 15-minute stale-claim reclaim in claim_due_posts() is the backstop
    console.error(`publisher: could not recover post ${post.id}; it will be reclaimed later:`, e)
  }

  return outcome
}

async function publishClaimedPostSafe(post: ClaimedPost, onlyPlatforms?: string[]): Promise<PublishOutcome> {
  try {
    return await publishClaimedPost(post, onlyPlatforms)
  } catch (err) {
    return recoverPost(post, err, onlyPlatforms !== undefined)
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Cron entry point: claim due posts (scheduled, due retries, stale claims)
 * and publish them.
 */
export async function runPublishCycle(
  limit = 6
): Promise<{ claimed: number; published: number; failed: number; needsManual: number; deferred: number }> {
  const admin = createAdminClient()
  const deadline = Date.now() + CYCLE_BUDGET_MS
  const { data, error } = await admin.rpc('claim_due_posts', {
    p_limit: Math.min(Math.max(Math.floor(limit), 1), 100),
  })
  if (error) throw error

  const posts = (data || []) as ClaimedPost[]
  const counts = { claimed: posts.length, published: 0, failed: 0, needsManual: 0, deferred: 0 }
  const deferred: string[] = []

  await runPool(posts, CYCLE_CONCURRENCY, async (post) => {
    if (Date.now() > deadline) {
      deferred.push(post.id)
      return
    }
    const outcome = await publishClaimedPostSafe(post)
    if (outcome.status === 'published') counts.published++
    else if (outcome.status === 'failed' || outcome.status === 'partially_published') counts.failed++
    if (outcome.needsManual.length > 0) counts.needsManual++
  })

  // Hand unstarted claims straight back: backdating the claim makes the next
  // run's stale-claim rule pick them up (none of their targets were touched).
  if (deferred.length > 0) {
    counts.deferred = deferred.length
    const { error: releaseError } = await admin
      .from('content_posts')
      .update({ publish_claimed_at: new Date(Date.now() - STALE_CLAIM_MS - 60_000).toISOString() })
      .in('id', deferred)
      .eq('status', 'publishing')
    if (releaseError) console.error('publisher: could not release deferred posts:', releaseError.message)
  }

  return counts
}

/**
 * "Publish now" / "Retry" for one post. The caller has verified that
 * `userId` owns the post. Refuses while another run is publishing it.
 */
export async function publishPostNow(
  postId: string,
  userId: string,
  platforms?: string[]
): Promise<PublishOutcome> {
  const admin = createAdminClient()

  const { data: existing, error: loadError } = await admin
    .from('content_posts')
    .select('id, platforms, platform_variants')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  if (loadError) throw loadError
  if (!existing) throw new Error('Post not found')

  const postPlatforms = postPlatformList(existing)
  if (postPlatforms.length === 0) {
    throw new ValidationError('Choose at least one platform for this post first')
  }

  let selected = postPlatforms
  if (platforms !== undefined) {
    if (!Array.isArray(platforms)) throw new ValidationError('platforms must be an array')
    selected = postPlatforms.filter((p) => platforms.includes(p))
    if (selected.length === 0) {
      throw new ValidationError("Choose at least one of this post's platforms")
    }
  }

  // Claim the post unless a run (cron or another click) is already on it
  const nowIso = new Date().toISOString()
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('content_posts')
    .update({ status: 'publishing', publish_claimed_at: nowIso, updated_at: nowIso })
    .eq('id', postId)
    .eq('user_id', userId)
    .or(`status.neq.publishing,publish_claimed_at.is.null,publish_claimed_at.lt."${staleBefore}"`)
    .select('*')
    .maybeSingle()
  if (claimError) throw claimError
  if (!claimed) throw new ValidationError('This post is already being published')

  return publishClaimedPostSafe(claimed as ClaimedPost, selected)
}
