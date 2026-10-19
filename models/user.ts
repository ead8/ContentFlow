export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  user_type: string | null
  plan: string
  credits: number
  is_onboarded: boolean
  created_at: string
}

export type OnboardingType = {
  user_id: string
  platforms: string[]
  pain_points: string[]
  business_type: string
  niche_title: string
  niche_description: string
}
