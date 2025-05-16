import { createClient } from '../supabase/client'
import { CreditUsage, OnboardingType, UserProfile } from '@/models/user'

export async function handleOnboarding(onboardingData: OnboardingType): Promise<boolean> {
  const supabase = createClient()

  const { user_id, platforms, content_styles, post_frequency

, start_date } = onboardingData

  // Save preferences
  const { error: prefError } = await supabase.from('user_preference').insert([
    { user_id, platforms, content_styles, post_frequency

, start_date },
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


export async function fetchCreditUsage(): Promise<CreditUsage> {
    const supabase = createClient()
    const { data: { session }} = await supabase.auth.getSession()

    if (!session) {
      throw new Error('User is not authenticated')
    }

    const { data, error } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', session.user.id)
    .single()
    

    if (error) {
      throw new Error(error.message)
    }

    return data as CreditUsage
}
