export type ContentGenerationRequest = {
  platform: string[]
  prompt: string
  tone: string
  audience: string
}

export type ContentGenerationResponse = {
  /** Campaign title */
  name: string
  /** One-sentence summary of the campaign angle */
  description: string
  /** Copy per platform, keyed by platform id (see lib/platforms.ts) */
  platform_posts: {
    [platform: string]: PlatformPost
  }
  additional_notes?: string
}

export type PlatformPost = {
  post?: string
  caption?: string
  hashtags?: string[]
  emojis?: string[]
  call_to_action?: string
  image_suggestion?: string
  video_suggestion?: string
  title?: string
  description?: string
}

export type AddFeedbackRequest = {
  feedback: string
  rating: number
  source: string
}
