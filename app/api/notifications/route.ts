import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function unreadCount(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

/**
 * GET /api/notifications?limit=20
 * -> { notifications: [{ id, type, title, body, link, read_at, created_at }], unread }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const raw = Number(request.nextUrl.searchParams.get('limit') ?? 20)
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 100) : 20

    const [{ data, error }, unread] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      unreadCount(supabase, userId),
    ])
    if (error) throw error

    return NextResponse.json({ success: true, data: { notifications: data || [], unread } })
  } catch (error) {
    return apiError(error, 'Error fetching notifications')
  }
}

/**
 * POST /api/notifications  Body: { ids?: string[], all?: true } -> mark read
 * -> { unread }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const supabase = createClient()
    const body = await request.json().catch(() => ({}))

    const all = body?.all === true
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id)).slice(0, 200)
      : []

    if (!all && ids.length === 0) throw new ValidationError('Provide ids or all: true')

    let query = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    if (!all) query = query.in('id', ids)

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: { unread: await unreadCount(supabase, userId) } })
  } catch (error) {
    return apiError(error, 'Error updating notifications')
  }
}
