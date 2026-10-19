import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { getCreditBalance } from '@/lib/services/credits'
import { CREDIT_COSTS } from '@/lib/billing/plans'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  type: 'post_due' | 'low_credits' | 'onboarding'
  title: string
  body: string
  href: string
}

/**
 * In-app notifications derived from the user's data:
 * - scheduled posts that are due (or due within the next hour)
 * - low credit balance
 * - onboarding not finished
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const [{ data: due, error }, { data: profile }, balance] = await Promise.all([
      supabase
        .from('content_posts')
        .select('id, title, content, scheduled_for')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .lte('scheduled_for', soon)
        .order('scheduled_for', { ascending: true })
        .limit(20),
      supabase.from('profiles').select('is_onboarded').eq('id', userId).single(),
      getCreditBalance(),
    ])

    if (error) throw error

    const now = Date.now()
    const notifications: Notification[] = (due || []).map((p) => {
      const overdue = new Date(p.scheduled_for!).getTime() <= now
      return {
        id: `post-${p.id}`,
        type: 'post_due',
        title: overdue ? 'Post ready to publish' : 'Post due within the hour',
        body: p.title || p.content.slice(0, 80),
        href: `/posts/${p.id}`,
      }
    })

    if (balance.credits < CREDIT_COSTS.text) {
      notifications.push({
        id: 'low-credits',
        type: 'low_credits',
        title: 'Out of credits',
        body: `You have ${balance.credits} credits left. Upgrade to keep generating.`,
        href: '/billing',
      })
    }

    if (profile && !profile.is_onboarded) {
      notifications.push({
        id: 'onboarding',
        type: 'onboarding',
        title: 'Finish setting up',
        body: 'Tell us about your business so we can tailor your content.',
        href: '/onboarding',
      })
    }

    return NextResponse.json({ success: true, data: notifications })
  } catch (error) {
    return apiError(error, 'Error fetching notifications')
  }
}
