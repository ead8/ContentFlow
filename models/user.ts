export type UserProfile = {
    id: string
    full_name: string
    role: string
    is_onboarded: boolean
}

export type OnboardingType = {
    user_id: string
    platforms: string[]
    content_styles: string[]
    post_frequency: string
    start_date: string | null
}