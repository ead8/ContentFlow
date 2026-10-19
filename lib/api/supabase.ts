import { createClient } from '../supabase/client'
import { OnboardingType, UserProfile } from '@/models/user'

/**
 * Save onboarding answers (re-running onboarding overwrites them) and mark
 * the profile as onboarded.
 */
export async function handleOnboarding(onboardingData: OnboardingType): Promise<boolean> {
  const supabase = createClient()

  const { user_id, platforms, business_type, pain_points, niche_description, niche_title } = onboardingData

  const { error: prefError } = await supabase.from('user_preference').upsert(
    {
      user_id,
      platforms,
      business_type,
      pain_points,
      niche_description,
      niche_title,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (prefError) throw new Error(prefError.message)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_onboarded: true })
    .eq('id', user_id)

  if (profileError) throw new Error(profileError.message)

  return true
}

export async function fetchLoggedinUserProfile(): Promise<UserProfile> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User is not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, user_type, plan, credits, is_onboarded, created_at')
    .eq('id', user.id)
    .single()

  if (error) throw new Error(error.message)

  return data as UserProfile
}
