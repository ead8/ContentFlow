import { WizardFormData } from '@/components/generate/MultiStep';
import { AddFeedbackRequest, ContentGenerationRequest, ContentGenerationResponse, MediaGenerationRequest, MediaGenerationResult } from '@/models/content';

/**
 * Client for app features (dashboard data, AI generation, posts, feedback).
 *
 * These functions talk to the app's own API routes, which are backed by
 * Supabase and OpenAI. The historical name of this module references n8n,
 * which is no longer required.
 */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }

  return body.data as T;
}

export async function fetchDashboardStats() {
  return api<{
    totalPosts: number;
    engagementRate: number;
    avgReach: number;
    videoViews: number;
    weeklyData: { name: string; value: number }[];
  }>('/api/dashboard/stats');
}

export interface DashboardPostEngagement {
  likes: number;
  comments: number;
  reach: number;
}

export interface DashboardPost {
  id: string;
  thumbnail: string;
  title: string;
  status: 'posted' | 'scheduled' | 'draft';
  platform: string;
  date: string;
  engagement?: DashboardPostEngagement;
}

export async function fetchPostPerformance(): Promise<DashboardPost[]> {
  return api<DashboardPost[]>('/api/dashboard/performance');
}

export async function fetchCreditUsage() {
  return api<{
    image_credits_used: number;
    video_credits_used: number;
    total_image_credits: number;
    total_video_credits: number;
  }>('/api/dashboard/credits');
}

export interface AccountPlatform {
  name: string;
  status: 'connected' | 'disconnected';
  profile?: string;
  lastSync?: string;
}

export interface AccountSummaryData {
  platforms: AccountPlatform[];
  teamMembers: { id: string; name: string; initials: string; role: string }[];
  subscription: { upgradeAvailable?: boolean };
}

export async function fetchAccountSummary(): Promise<AccountSummaryData> {
  return api<AccountSummaryData>('/api/dashboard/account');
}

export async function generateContent(data: ContentGenerationRequest): Promise<ContentGenerationResponse> {
  const result = await api<ContentGenerationResponse>('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!result.name || !result.description || !result.platform_posts) {
    throw new Error('AI generation returned an incomplete response.');
  }

  return result;
}

export async function generateImage(data: { prompt?: string }): Promise<string> {
  const prompt = data.prompt?.trim();
  if (!prompt) {
    throw new Error('An image prompt is required.');
  }

  const result = await api<{ image_url: string }>('/api/ai/image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  if (!result.image_url) {
    throw new Error('No image URL returned.');
  }

  return result.image_url;
}

export async function generateMedia(_request: MediaGenerationRequest): Promise<MediaGenerationResult> {
  throw new Error(
    'Video generation is not configured. Connect Tavus/Shotstack or n8n to enable it.'
  );
}

export async function createPost(data: WizardFormData): Promise<string> {
  const step1 = data.step_1;
  const firstPlatform = data.platform?.[0];
  const firstPost = (firstPlatform && step1?.platform_posts?.[firstPlatform]) || undefined;

  const mediaUrls: string[] = [];
  if (data.step_2?.image_upload) mediaUrls.push(data.step_2.image_upload);
  if (data.step_3?.video_url) mediaUrls.push(data.step_3.video_url);

  const post = await api<{ id: string }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      title: step1?.name,
      content: firstPost?.post || firstPost?.caption || step1?.description || data.topic || 'Untitled post',
      media_urls: mediaUrls.length ? mediaUrls : undefined,
      tone: data.tone,
      scheduled_for: data.step_5?.schedule_at,
      generated_by_ai: true,
      credits_used: 10,
    }),
  });

  if (!post?.id) {
    throw new Error('Post was created but no ID was returned.');
  }

  return post.id;
}

export async function addFeedback(data: AddFeedbackRequest): Promise<string> {
  const result = await api<{ id: string }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!result?.id) {
    throw new Error('Feedback was not saved.');
  }

  return result.id;
}

export async function pollVideoStatus(
  _jobId: string,
  _mediaId: string,
  _options?: {
    maxAttempts?: number;
    initialInterval?: number;
    slowInterval?: number;
    switchAfterMs?: number;
  }
): Promise<string> {
  throw new Error(
    'Video generation is not configured. Connect Tavus/Shotstack or n8n to enable it.'
  );
}
