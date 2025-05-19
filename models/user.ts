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


export type CreditUsage = {
    id: string
    user_id: string
    image_credits_used: number
    video_credits_used: number,
    total_image_credits: number,
    total_video_credits: number,
    locked_out: boolean,
    trial_expiry: string,
    updated_at: string,
    created_at: string,
}