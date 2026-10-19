import { Post } from '@/models/content'
import { createClient } from '../supabase/client'
import { OnboardingType, UserProfile } from '@/models/user'

export async function handleOnboarding(onboardingData: OnboardingType): Promise<boolean> {
  const supabase = createClient()

  const { user_id, platforms, business_type, pain_points, niche_description, niche_title } = onboardingData

  // Save preferences
  const { error: prefError } = await supabase.from('user_preference').insert([
    { user_id, platforms, business_type, pain_points, niche_description, niche_title },
  ])

  if (prefError) {
    throw new Error(prefError.message)
  }

  // Update onboarding status
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_onboarded: true })
    .eq('id', user_id)

  if (profileError) {
    throw new Error(profileError.message)
  }
  
  return true
}

export async function fetchLoggedinUserProfile(): Promise<UserProfile> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
        throw new Error('User is not authenticated')
    }
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
    
    if (error) {
        throw new Error(error.message)
    }
    
    return data as UserProfile
}


/**
 * Credit wallet summary. Delegates to GET /api/dashboard/credits so the
 * browser never reads the legacy per-user `usage` table pools.
 */
export { fetchCreditUsage } from '@/lib/n8n/client'
export type { CreditSummary } from '@/lib/n8n/client'


export async function fetchPostList(): Promise<Post[]> {
  const res = await fetch('/api/posts?limit=100')
  const body = await res.json().catch(() => null)

  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Failed to load posts (${res.status})`)
  }

  // The posts API returns content_posts rows; map them onto the legacy
  // Post shape used by older components.
  return (body.data || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    topic: p.title || p.content?.slice(0, 60) || 'Untitled',
    platform_variants: {},
    status: p.status,
    created_at: p.created_at,
    schedule_at: p.scheduled_for || p.created_at,
  }))
}