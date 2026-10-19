import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { getCreditBalance } from '@/lib/services/credits'
import { CREDIT_COSTS } from '@/lib/billing/plans'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Scheduled posts still waiting this long after their time were missed by the publisher */
const OVERDUE_GRACE_MS = 10 * 60 * 1000

export interface Alert {
  id: string
  type: 'post_overdue' | 'low_credits' | 'onboarding'
  title: string
  body: string
  link: string
}

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
 * Live, state-derived alerts (not stored): they disappear on their own once
 * the underlying condition is resolved.
 */
async function currentAlerts(supabase: ReturnType<typeof createClient>, userId: string): Promise<Alert[]> {
  const overdueBefore = new Date(Date.now() - OVERDUE_GRACE_MS).toISOString()

  const [{ data: overdue, error }, { data: profile }, balance] = await Promise.all([
    supabase
      .from('content_posts')
      .select('id, title, content')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .lte('scheduled_for', overdueBefore)
      .order('scheduled_for', { ascending: true })
      .limit(10),
    supabase.from('profiles').select('is_onboarded').eq('id', userId).single(),
    getCreditBalance(),
  ])
  if (error) throw error

  const alerts: Alert[] = (overdue || []).map((p) => ({
    id: `overdue-${p.id}`,
    type: 'post_overdue',
    title: 'Scheduled post not published yet',
    body: p.title || p.content.slice(0, 80),
    link: `/posts/${p.id}`,
  }))

  if (balance.credits < CREDIT_COSTS.text) {
    alerts.push({
      id: 'low-credits',
      type: 'low_credits',
      title: 'Out of credits',
      body: `You have ${balance.credits} credits left. Upgrade to keep generating.`,
      link: '/billing',
    })
  }

  if (profile && !profile.is_onboarded) {
    alerts.push({
      id: 'onboarding',
      type: 'onboarding',
      title: 'Finish setting up',
      body: 'Tell us about your business so we can tailor your content.',
      link: '/onboarding',
    })
  }

  return alerts
}

/**
 * GET /api/notifications?limit=20
 * -> { notifications: [{ id, type, title, body, link, read_at, created_at }], unread, alerts }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const raw = Number(request.nextUrl.searchParams.get('limit') ?? 20)
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 100) : 20

    const [{ data, error }, unread, alerts] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      unreadCount(supabase, userId),
      currentAlerts(supabase, userId),
    ])
    if (error) throw error

    return NextResponse.json({ success: true, data: { notifications: data || [], unread, alerts } })
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
