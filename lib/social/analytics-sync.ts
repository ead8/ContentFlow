import { createAdminClient } from '@/lib/supabase/admin'
import { PLATFORMS, type Platform } from '@/lib/platforms'
import { METRIC_TYPES } from '@/lib/services/content-posts'
import { getAdapter } from './registry'
import { PlatformError, type SocialAccount } from './types'
import { getAccountById, listActivePublishingAccounts, markAccountStatus } from './accounts'

/**
 * Pulls engagement numbers for auto-published posts into post_analytics and
 * daily follower counts into platform_analytics. Server-only.
 */

/** Only posts published this recently are refreshed */
const METRICS_WINDOW_DAYS = 30
/** Don't refresh a post more often than this */
const MIN_RESYNC_MS = 3 * 60 * 60_000
/** Account follower snapshots per run */
const ACCOUNT_METRICS_LIMIT = 50

interface MetricsTarget {
  id: string
  post_id: string
  platform: string
  social_account_id: string
  external_id: string
}

export interface AnalyticsSyncResult {
  /** Published targets considered */
  targets: number
  /** Targets whose metrics were saved */
  updated: number
  /** Accounts whose follower count was saved */
  accounts: number
  /** Targets or accounts that errored */
  failed: number
}

function isPlatform(p: unknown): p is Platform {
  return typeof p === 'string' && (PLATFORMS as readonly string[]).includes(p)
}

function toCount(v: unknown): number | null {
  const n = Number(v)
  if (v === undefined || v === null || !Number.isFinite(n) || n < 0) return null
  return Math.min(Math.round(n), 2_000_000_000)
}

async function loadAccount(accountId: string): Promise<SocialAccount | null> {
  try {
    return await getAccountById(accountId)
  } catch (err) {
    if (err instanceof PlatformError && err.reauthRequired) {
      // accounts.ts marks it expired when the refresh fails
      return null
    }
    throw err
  }
}

async function handleAccountError(account: SocialAccount, err: unknown, context: string) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`analytics-sync: ${context} for account ${account.id} (${account.platform}): ${message}`)
  if (err instanceof PlatformError && err.reauthRequired) {
    try {
      await markAccountStatus(account.id, 'expired', message.slice(0, 500))
    } catch (markError) {
      console.error('analytics-sync: could not mark account expired:', markError)
    }
  }
}

/**
 * Refresh metrics for up to `limit` published targets (least recently
 * synced first), then take today's follower snapshot for active accounts
 * that don't have one yet.
 */
export async function runAnalyticsSync(limit = 50): Promise<AnalyticsSyncResult> {
  const admin = createAdminClient()
  const result: AnalyticsSyncResult = { targets: 0, updated: 0, accounts: 0, failed: 0 }

  // ---- 1. Post metrics --------------------------------------------------
  const since = new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60_000).toISOString()
  const resyncBefore = new Date(Date.now() - MIN_RESYNC_MS).toISOString()

  const { data: rows, error } = await admin
    .from('post_targets')
    .select('id, post_id, platform, social_account_id, external_id')
    .eq('status', 'published')
    .not('external_id', 'is', null)
    .not('social_account_id', 'is', null)
    .gte('published_at', since)
    .or(`metrics_synced_at.is.null,metrics_synced_at.lt."${resyncBefore}"`)
    .order('metrics_synced_at', { ascending: true, nullsFirst: true })
    .limit(Math.min(Math.max(Math.floor(limit), 1), 500))
  if (error) throw error

  const targets = (rows || []) as MetricsTarget[]
  result.targets = targets.length

  const byAccount = new Map<string, MetricsTarget[]>()
  for (const t of targets) {
    const list = byAccount.get(t.social_account_id) || []
    list.push(t)
    byAccount.set(t.social_account_id, list)
  }

  const markSynced = async (ids: string[]) => {
    if (ids.length === 0) return
    const { error: syncError } = await admin
      .from('post_targets')
      .update({ metrics_synced_at: new Date().toISOString() })
      .in('id', ids)
    if (syncError) console.error('analytics-sync: could not set metrics_synced_at:', syncError.message)
  }

  for (const [accountId, accountTargets] of Array.from(byAccount.entries())) {
    let account: SocialAccount | null
    try {
      account = await loadAccount(accountId)
    } catch (err) {
      console.error(`analytics-sync: could not load account ${accountId}:`, err instanceof Error ? err.message : err)
      result.failed += accountTargets.length
      continue
    }

    const adapter = account && isPlatform(account.platform) ? getAdapter(account.platform) : null
    if (!account || !adapter?.fetchPostMetrics) {
      // Disconnected/expired account or a platform without metrics: rotate
      // these to the back of the queue
      await markSynced(accountTargets.map((t) => t.id))
      continue
    }

    for (const target of accountTargets) {
      try {
        const metrics = await adapter.fetchPostMetrics(account, target.external_id)
        const recordedAt = new Date().toISOString()
        const metricRows = METRIC_TYPES.flatMap((type) => {
          const count = toCount((metrics as Record<string, unknown>)[type])
          return count === null
            ? []
            : [{ post_id: target.post_id, platform: target.platform, engagement_type: type, count, recorded_at: recordedAt }]
        })

        if (metricRows.length > 0) {
          const { error: upsertError } = await admin
            .from('post_analytics')
            .upsert(metricRows, { onConflict: 'post_id,platform,engagement_type' })
          if (upsertError) throw upsertError
        }
        await markSynced([target.id])
        result.updated++
      } catch (err) {
        result.failed++
        await handleAccountError(account, err, `metrics for target ${target.id}`)
        if (err instanceof PlatformError && (err.reauthRequired || err.retryable)) {
          // Expired token or rate limit: stop using this account this run
          break
        }
        // Permanent error for this post (e.g. deleted on the platform)
        await markSynced([target.id])
      }
    }
  }

  // ---- 2. Daily follower snapshot -----------------------------------------
  try {
    result.accounts = await syncAccountMetrics(admin)
  } catch (err) {
    console.error('analytics-sync: account metrics failed:', err instanceof Error ? err.message : err)
    result.failed++
  }

  return result
}

async function syncAccountMetrics(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)

  const active = (await listActivePublishingAccounts()).filter((a) => {
    if (!isPlatform(a.platform)) return false
    return Boolean(getAdapter(a.platform)?.fetchAccountMetrics)
  })
  if (active.length === 0) return 0

  const { data: done, error } = await admin
    .from('platform_analytics')
    .select('social_account_id')
    .eq('metric_date', today)
    .in('social_account_id', active.map((a) => a.id))
  if (error) throw error

  const doneIds = new Set((done || []).map((r: { social_account_id: string | null }) => r.social_account_id))
  const due = active.filter((a) => !doneIds.has(a.id)).slice(0, ACCOUNT_METRICS_LIMIT)

  let saved = 0
  for (const listed of due) {
    let account: SocialAccount | null = null
    try {
      account = await loadAccount(listed.id)
      if (!account) continue
      const adapter = getAdapter(account.platform)
      const metrics = await adapter.fetchAccountMetrics!(account)
      const followers = toCount(metrics?.followers)

      const { error: upsertError } = await admin.from('platform_analytics').upsert(
        {
          user_id: account.userId,
          social_account_id: account.id,
          platform: account.platform,
          metric_date: today,
          followers_count: followers,
          recorded_at: new Date().toISOString(),
        },
        { onConflict: 'social_account_id,metric_date' }
      )
      if (upsertError) throw upsertError
      saved++
    } catch (err) {
      await handleAccountError(account ?? listed, err, 'account metrics')
    }
  }
  return saved
}
