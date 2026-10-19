import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { getPlan } from '@/lib/billing/plans'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * Account summary for the dashboard: the user, their plan and the platforms
 * they create content for (from onboarding).
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    const [{ data: profile, error }, { data: prefs }] = await Promise.all([
      supabase
        .from('profiles')
        .select('email, full_name, plan, is_onboarded')
        .eq('id', userId)
        .single(),
      supabase
        .from('user_preference')
        .select('platforms, business_type, niche_title')
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    if (error) throw error

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Member'
    const initials = name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    const plan = getPlan(profile?.plan)

    return NextResponse.json({
      success: true,
      data: {
        name,
        initials,
        email: profile?.email,
        isOnboarded: Boolean(profile?.is_onboarded),
        platforms: prefs?.platforms || [],
        businessType: prefs?.business_type || null,
        niche: prefs?.niche_title || null,
        plan: { id: plan.id, name: plan.name, monthlyCredits: plan.monthlyCredits },
        upgradeAvailable: plan.id !== 'enterprise',
      },
    })
  } catch (error) {
    return apiError(error, 'Error fetching account summary')
  }
}
