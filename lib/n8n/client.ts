import { WizardFormData } from '@/components/generate/MultiStep';
import { AddFeedbackRequest, ContentGenerationRequest, ContentGenerationResponse, MediaGenerationRequest, MediaGenerationResult } from '@/models/content';

/**
 * Client for app features (dashboard data, AI generation, posts, feedback).
 *
 * These functions talk to the app's own API routes, which are backed by
 * Supabase and OpenAI. The historical name of this module references n8n,
 * which is no longer required.
 */

/** Error thrown by the API helper; carries the HTTP status code */
export class ApiRequestError extends Error {
  name = 'ApiRequestError';
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** True when the server refused an AI operation because the wallet is too low (HTTP 402) */
export function isInsufficientCreditsError(error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status === 402) return true;
  return error instanceof Error && error.message === 'Insufficient credits';
}

/** Window event fired whenever the credit balance may have changed */
export const CREDITS_CHANGED_EVENT = 'credits:changed';

/** Tell credit displays (header badge, dashboard tracker, ...) to refetch */
export function notifyCreditsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
  }
}

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
    throw new ApiRequestError(body?.error || `Request failed (${res.status})`, res.status);
  }

  return body.data as T;
}

/**
 * Run an AI request that is billed from the credit wallet and let the credit
 * displays know the balance changed (also when it was refused with 402).
 */
async function billed<T>(request: () => Promise<T>): Promise<T> {
  try {
    const result = await request();
    notifyCreditsChanged();
    return result;
  } catch (error) {
    if (isInsufficientCreditsError(error)) notifyCreditsChanged();
    throw error;
  }
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

/**
 * The user's credit wallet (profiles.credits), as billed by the server.
 * Returned by GET /api/dashboard/credits.
 */
export interface CreditSummary {
  /** Credits remaining */
  credits: number;
  plan: string;
  plan_name: string;
  monthly_allowance: number;
  credits_refreshed_at: string;
  /** Credits spent since credits_refreshed_at */
  used_this_period: number;
  used_by_kind: { text: number; image: number; video: number };
  next_refresh_at: string;
}

export async function fetchCreditUsage(): Promise<CreditSummary> {
  return api<CreditSummary>('/api/dashboard/credits');
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
  const result = await billed(() =>
    api<ContentGenerationResponse>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  );

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

  const result = await billed(() =>
    api<{ image_url: string }>('/api/ai/image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  );

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
      // Needed by the auto-publisher: which platforms to post to and the per-platform text
      platforms: data.platform,
      platform_variants: step1?.platform_posts,
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
