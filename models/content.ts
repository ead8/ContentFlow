export type ContentGenerationRequest = {
    platform: string[];
    prompt: string;
    tone: string;
    audience: string;
}

export type ContentGenerationResponse = {
  name: string; // Title or name of the generated content
  description: string; // Description of the content
  platform_posts: {
    [platform: string]: PlatformPost; // Key-value pairs for platform names (e.g., LinkedIn, Instagram, etc.)
  };
  additional_notes?: string; // Additional information or notes about the content
};

export type PlatformPost = {
  image_suggestion?: string;
  post?: string;
  caption?: string;
  hashtags?: string[];
  emojis?: string[];
  video_suggestion?: string;
  call_to_action?: string;
  character_limit?: number;
  title?: string;
  description?: string;
};

export type MediaGenerationRequest = {
  prompt: string;
  media_type: string,
  cron_job: boolean
}


export interface MediaGenerationResult {
  mediaId: string;
  jobId: string;
}


export type AddFeedbackRequest = {
  feedback: string;
  rating: number;
  source: string;
}