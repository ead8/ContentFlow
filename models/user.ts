export type UserProfile = {
    id: string
    full_name: string
    role: string
    is_onboarded: boolean
}

export type OnboardingType = {
    user_id: string
    platforms: string[]
    pain_points: string[]
    business_type: string
    niche_title: string
    niche_description: string
}


/**
 * @deprecated Legacy `usage` table row. Credits are billed from the wallet
 * (profiles.credits); use CreditSummary from '@/lib/n8n/client'.
 */
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