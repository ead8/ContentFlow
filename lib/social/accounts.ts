import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms'
import { decryptToken, encryptToken } from './crypto'
import { getAdapter } from './registry'
import {
  PlatformError,
  type ConnectedAccountInfo,
  type OAuthTokens,
  type SocialAccount,
} from './types'

/**
 * Connected social accounts: storing tokens encrypted, loading them for the
 * publisher and refreshing them before they expire. Server-only — uses the
 * service-role client, so callers must have checked ownership already.
 */

const TABLE = 'social_accounts'
const REFRESH_WINDOW_MS = 5 * 60 * 1000

export type SocialAccountStatus = 'active' | 'expired' | 'error'

interface SocialAccountRow {
  id: string
  user_id: string
  platform: string
  account_id: string
  account_name: string
  account_type: string | null
  avatar_url: string | null
  metadata: Record<string, unknown> | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  scopes: string[] | null
  status: SocialAccountStatus
  last_error: string | null
  is_default: boolean
  updated_at: string | null
  created_at: string | null
}

const ROW_COLUMNS =
  'id, user_id, platform, account_id, account_name, account_type, avatar_url, metadata, access_token, refresh_token, token_expires_at, refresh_token_expires_at, scopes, status, last_error, is_default, updated_at, created_at'

function label(platform: string): string {
  return PLATFORM_LABELS[platform as Platform] ?? platform
}

function reconnectMessage(platform: string): string {
  return `Your ${label(platform)} connection has expired. Please reconnect it in Settings.`
}

function toIso(d: Date | null | undefined): string | null {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function encryptOptional(v: string | null | undefined): string | null {
  return v ? encryptToken(v) : null
}

function rowToAccount(row: SocialAccountRow): SocialAccount {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform as Platform,
    accountId: row.account_id,
    accountName: row.account_name,
    accountType: row.account_type ?? 'profile',
    metadata: row.metadata ?? {},
    accessToken: decryptToken(row.access_token),
    refreshToken: row.refresh_token ? decryptToken(row.refresh_token) : null,
    tokenExpiresAt: parseDate(row.token_expires_at),
  }
}

function isEncrypted(row: SocialAccountRow): boolean {
  return typeof row.access_token === 'string' && row.access_token.startsWith('v1:')
}

/**
 * Store the accounts returned by an OAuth callback. Upserts on
 * (user_id, platform, account_id) so reconnecting refreshes tokens in place.
 * Returns the number of accounts saved.
 */
export async function saveConnectedAccounts(
  userId: string,
  platform: Platform,
  accounts: ConnectedAccountInfo[],
  userTokens: OAuthTokens
): Promise<number> {
  if (accounts.length === 0) return 0
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const rows = accounts.map((account) => {
    const tokens = account.tokens ?? userTokens
    return {
      user_id: userId,
      platform,
      account_id: String(account.accountId),
      account_name: account.accountName || label(platform),
      account_type: account.accountType || 'profile',
      avatar_url: account.avatarUrl ?? null,
      metadata: account.metadata ?? {},
      access_token: encryptToken(tokens.accessToken),
      refresh_token: encryptOptional(tokens.refreshToken),
      token_expires_at: toIso(tokens.expiresAt),
      refresh_token_expires_at: toIso(tokens.refreshTokenExpiresAt),
      scopes: tokens.scopes ?? [],
      status: 'active' as const,
      last_error: null,
      is_connected: true,
      updated_at: now,
    }
  })

  // is_default is deliberately not part of the upsert so reconnecting an
  // account keeps its current default flag.
  const { data: saved, error } = await admin
    .from(TABLE)
    .upsert(rows, { onConflict: 'user_id,platform,account_id' })
    .select('id, account_id')
  if (error) throw error

  await ensureDefault(admin, userId, platform, saved?.[0]?.id ?? null)
  return saved?.length ?? rows.length
}

/**
 * Make sure the user has a default account for this platform: keep an
 * existing active default, otherwise promote `preferredId` (or the most
 * recently updated active account).
 */
async function ensureDefault(
  admin: SupabaseClient,
  userId: string,
  platform: Platform,
  preferredId: string | null
): Promise<void> {
  const { data: current, error } = await admin
    .from(TABLE)
    .select('id, status')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  if (current && current.status === 'active') return

  let targetId = preferredId
  if (!targetId) {
    const { data: candidate } = await admin
      .from(TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    targetId = candidate?.id ?? null
  }
  if (!targetId || targetId === current?.id) return

  if (current) {
    await admin.from(TABLE).update({ is_default: false }).eq('id', current.id)
  }
  const { error: setError } = await admin
    .from(TABLE)
    .update({ is_default: true })
    .eq('id', targetId)
    .eq('user_id', userId)
  // A concurrent request may have set a default already (unique index) — fine.
  if (setError && setError.code !== '23505') throw setError
}

/** Load a row's tokens, refreshing them first if they expire within 5 minutes */
async function loadWithFreshTokens(admin: SupabaseClient, row: SocialAccountRow): Promise<SocialAccount> {
  if (!isEncrypted(row)) {
    await markAccountStatus(row.id, 'expired', 'Please reconnect this account.')
    throw new PlatformError(reconnectMessage(row.platform), { reauthRequired: true })
  }

  let account: SocialAccount
  try {
    account = rowToAccount(row)
  } catch (err) {
    // Missing key is a server misconfiguration, not the user's fault
    if (err instanceof Error && /TOKEN_ENCRYPTION_KEY/.test(err.message)) throw err
    await markAccountStatus(row.id, 'expired', 'Please reconnect this account.')
    throw new PlatformError(reconnectMessage(row.platform), { reauthRequired: true })
  }

  const expiresAt = account.tokenExpiresAt
  if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_WINDOW_MS) return account

  const adapter = getAdapter(account.platform)
  const refreshExpiresAt = parseDate(row.refresh_token_expires_at)
  const canRefresh =
    !!adapter?.refreshTokens &&
    !!account.refreshToken &&
    (!refreshExpiresAt || refreshExpiresAt.getTime() > Date.now())

  if (!canRefresh) {
    await markAccountStatus(row.id, 'expired', reconnectMessage(row.platform))
    throw new PlatformError(reconnectMessage(row.platform), { reauthRequired: true })
  }

  let fresh: OAuthTokens
  try {
    fresh = await adapter.refreshTokens!(account.refreshToken!)
  } catch (err) {
    const retryable =
      err instanceof PlatformError ? err.retryable && !err.reauthRequired : !(err instanceof PlatformError)
    if (retryable) {
      // Network blip / provider outage: try again later, keep the account active
      const message = err instanceof PlatformError ? err.message : `${label(row.platform)} token refresh failed. Please try again.`
      throw new PlatformError(message, { retryable: true, status: err instanceof PlatformError ? err.status : undefined })
    }

    // Another worker may have refreshed (and rotated) the token concurrently
    const { data: latest } = await admin.from(TABLE).select(ROW_COLUMNS).eq('id', row.id).maybeSingle()
    const latestRow = latest as SocialAccountRow | null
    const latestExp = parseDate(latestRow?.token_expires_at)
    if (
      latestRow &&
      latestRow.status === 'active' &&
      latestRow.access_token !== row.access_token &&
      isEncrypted(latestRow) &&
      (!latestExp || latestExp.getTime() - Date.now() > REFRESH_WINDOW_MS)
    ) {
      return rowToAccount(latestRow)
    }

    console.error(`Token refresh failed for ${row.platform} account ${row.id}:`, err instanceof Error ? err.message : 'unknown error')
    await markAccountStatus(row.id, 'expired', reconnectMessage(row.platform))
    throw new PlatformError(reconnectMessage(row.platform), { reauthRequired: true })
  }

  const newRefresh = fresh.refreshToken || account.refreshToken
  const update: Record<string, unknown> = {
    access_token: encryptToken(fresh.accessToken),
    refresh_token: encryptOptional(newRefresh),
    token_expires_at: toIso(fresh.expiresAt),
    status: 'active',
    last_error: null,
    is_connected: true,
    updated_at: new Date().toISOString(),
  }
  // Persist the refresh-token expiry when the provider sends one. A rotated
  // refresh token without an expiry must not inherit the old token's expiry;
  // otherwise (no new token, no expiry) keep what is stored.
  if (fresh.refreshTokenExpiresAt !== undefined && fresh.refreshTokenExpiresAt !== null) {
    update.refresh_token_expires_at = toIso(fresh.refreshTokenExpiresAt)
  } else if (fresh.refreshToken) {
    update.refresh_token_expires_at = null
  }
  if (fresh.scopes?.length) update.scopes = fresh.scopes

  const { error } = await admin.from(TABLE).update(update).eq('id', row.id)
  if (error) throw error

  return {
    ...account,
    accessToken: fresh.accessToken,
    refreshToken: newRefresh ?? null,
    tokenExpiresAt: fresh.expiresAt ?? null,
  }
}

/**
 * The account to publish to for this user/platform: their default active
 * account, else the most recently updated active one. Tokens are refreshed
 * when needed; throws PlatformError(reauthRequired) if that is impossible.
 */
export async function getPublishingAccount(userId: string, platform: Platform): Promise<SocialAccount | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return loadWithFreshTokens(admin, data as SocialAccountRow)
}

/** An active account by id (any user), with fresh tokens; null if not active */
export async function getAccountById(accountId: string): Promise<SocialAccount | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq('id', accountId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return loadWithFreshTokens(admin, data as SocialAccountRow)
}

/**
 * Update an account's connection status. `lastError` undefined keeps the
 * current message, except that 'active' always clears it.
 */
export async function markAccountStatus(
  accountId: string,
  status: SocialAccountStatus,
  lastError?: string | null
): Promise<void> {
  const admin = createAdminClient()
  const update: Record<string, unknown> = {
    status,
    is_connected: status === 'active',
    updated_at: new Date().toISOString(),
  }
  if (status === 'active') update.last_error = null
  else if (lastError !== undefined) update.last_error = lastError ? String(lastError).slice(0, 500) : null

  const { error } = await admin.from(TABLE).update(update).eq('id', accountId)
  if (error) throw error
}

/**
 * All active accounts with decrypted tokens (for analytics sync). Tokens are
 * NOT refreshed here — call getAccountById before using one.
 */
export async function listActivePublishingAccounts(): Promise<SocialAccount[]> {
  const admin = createAdminClient()
  const pageSize = 500
  const result: SocialAccount[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(TABLE)
      .select(ROW_COLUMNS)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as SocialAccountRow[]

    for (const row of rows) {
      if (!isEncrypted(row)) {
        await markAccountStatus(row.id, 'expired', 'Please reconnect this account.').catch(() => {})
        continue
      }
      try {
        result.push(rowToAccount(row))
      } catch (err) {
        if (err instanceof Error && /TOKEN_ENCRYPTION_KEY/.test(err.message)) throw err
        await markAccountStatus(row.id, 'expired', 'Please reconnect this account.').catch(() => {})
      }
    }

    if (rows.length < pageSize) break
  }

  return result
}
