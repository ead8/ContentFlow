import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, ValidationError } from '@/lib/api/error'
import { requireUserId } from '@/lib/services/auth'
import { PLATFORMS, PLATFORM_LABELS } from '@/lib/platforms'
import { isEncryptionConfigured } from '@/lib/social/crypto'
import { getAdapter } from '@/lib/social/registry'
import { slugForPlatform } from '@/lib/social/types'

export const dynamic = 'force-dynamic'

/**
 * Non-secret columns granted to authenticated users. Never select `*`:
 * the token columns are not granted, so that query would fail.
 */
const ACCOUNT_COLUMNS =
  'id, platform, account_id, account_name, account_type, avatar_url, status, last_error, is_default, token_expires_at, created_at'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function notFound() {
  return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
}

function appConfigured(): boolean {
  return isEncryptionConfigured() && !!(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)
}

async function listAccounts(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('social_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .order('platform', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * GET /api/social-accounts -> the user's connected accounts and which
 * platforms can be connected on this deployment.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()
    const accounts = await listAccounts(supabase, userId)

    const baseConfigured = appConfigured()
    const platforms = PLATFORMS.map((platform) => {
      let configured = false
      try {
        configured = baseConfigured && !!getAdapter(platform)?.isConfigured()
      } catch {
        configured = false
      }
      return { platform, slug: slugForPlatform(platform), label: PLATFORM_LABELS[platform], configured }
    })

    return NextResponse.json({ success: true, data: { accounts, platforms } })
  } catch (error) {
    return apiError(error, 'Error fetching social accounts')
  }
}

/**
 * PATCH /api/social-accounts  Body: { id } -> make that account the default
 * for its platform. Returns the updated account list.
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!UUID_RE.test(id)) throw new ValidationError('A valid account id is required')

    const supabase = createClient()
    const { error } = await supabase.rpc('set_default_social_account', { p_account: id })
    if (error) {
      if (error.code === 'P0002') return notFound()
      throw error
    }

    const accounts = await listAccounts(supabase, userId)
    return NextResponse.json({ success: true, data: accounts })
  } catch (error) {
    return apiError(error, 'Error updating default social account')
  }
}

/**
 * DELETE /api/social-accounts?id=… -> disconnect an account. If it was the
 * default for its platform, another active account takes over.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const id = request.nextUrl.searchParams.get('id') || ''
    if (!UUID_RE.test(id)) throw new ValidationError('A valid account id is required')

    const supabase = createClient()
    const { data: account, error: findError } = await supabase
      .from('social_accounts')
      .select('id, platform, is_default')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (findError) throw findError
    if (!account) return notFound()

    const admin = createAdminClient()

    // post_targets.social_account_id is ON DELETE CASCADE; detach the
    // account first so publishing history survives the disconnect.
    const { error: detachError } = await admin
      .from('post_targets')
      .update({ social_account_id: null })
      .eq('social_account_id', id)
    if (detachError) throw detachError

    const { error: deleteError, count } = await supabase
      .from('social_accounts')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId)
    if (deleteError) throw deleteError
    if (!count) return notFound()

    if (account.is_default) {
      const { data: next } = await admin
        .from('social_accounts')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', account.platform)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (next) {
        const { error: promoteError } = await admin
          .from('social_accounts')
          .update({ is_default: true, updated_at: new Date().toISOString() })
          .eq('id', next.id)
          .eq('user_id', userId)
        // Unique-index conflict means a default was set concurrently — fine
        if (promoteError && promoteError.code !== '23505') throw promoteError
      }
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    return apiError(error, 'Error disconnecting social account')
  }
}
