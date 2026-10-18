import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Account summary for the dashboard: connected platforms, the user,
 * and subscription state.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const [{ data: accounts }, { data: profile }] = await Promise.all([
      supabase
        .from('social_accounts')
        .select('platform, account_name, is_connected, last_synced')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('email, full_name, role')
        .eq('id', userId)
        .single(),
    ])

    const platforms = (accounts || []).map((a) => ({
      name: a.platform,
      status: a.is_connected ? 'connected' : 'disconnected',
      profile: a.account_name,
      lastSync: a.last_synced,
    }))

    const name = profile?.full_name || profile?.email?.split('@')[0] || 'Member'
    const initials = name
      .split(/[\s._-]+/)
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return NextResponse.json({
      success: true,
      data: {
        platforms,
        teamMembers: [
          {
            id: userId,
            name,
            initials,
            role: profile?.role === 'admin' ? 'Admin' : 'Owner',
          },
        ],
        subscription: {
          upgradeAvailable: (profile?.role || 'free') === 'free',
        },
      },
    })
  } catch (error) {
    return apiError(error, 'Error fetching account summary')
  }
}
