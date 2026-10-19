/**
 * Browser-side client for the app's API routes.
 * Every route returns { success: true, data } or { success: false, error }.
 */
import type { ContentGenerationRequest, ContentGenerationResponse, AddFeedbackRequest, PlatformPost } from '@/models/content'

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok || body?.success === false) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status)
  }

  return body?.data as T
}

/** True when the error means the user ran out of credits */
export function isInsufficientCredits(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostStatus = 'draft' | 'scheduled' | 'published'

export interface Post {
  id: string
  title: string | null
  description: string | null
  content: string
  media_urls: string[] | null
  status: PostStatus
  scheduled_for: string | null
  published_at: string | null
  tone: string
  language: string
  generated_by_ai: boolean
  platforms: string[]
  platform_variants: Record<string, PlatformPost>
  created_at: string
  updated_at: string
}

export interface PostTarget {
  id: string
  platform: string
  status: string
  published_at: string | null
  external_url: string | null
}

export interface PostMetric {
  platform: string
  engagement_type: string
  count: number
  recorded_at: string
}

export interface PostDetail extends Post {
  targets: PostTarget[]
  metrics: PostMetric[]
}

export interface CreditBalance {
  credits: number
  plan: string
  plan_name: string
  monthly_allowance: number
  credits_refreshed_at: string
}

export interface CreditUsageSummary extends CreditBalance {
  used_this_period: number
  used_by_kind: { text: number; image: number; video: number }
  next_refresh_at: string
}

export interface CreditTransaction {
  id: string
  amount: number
  transaction_type: string
  kind: string | null
  description: string | null
  balance_after: number | null
  created_at: string
}

export interface DashboardStats {
  totalPosts: number
  scheduledPosts: number
  publishedPosts: number
  engagementRate: number
  impressions: number
  weeklyData: { name: string; value: number }[]
}

export interface DashboardPost {
  id: string
  thumbnail: string
  title: string
  status: 'posted' | 'scheduled' | 'draft'
  platforms: string[]
  date: string
  engagement?: { likes: number; comments: number; reach: number }
}

export interface AccountSummaryData {
  name: string
  initials: string
  email?: string
  isOnboarded: boolean
  platforms: string[]
  businessType: string | null
  niche: string | null
  plan: { id: string; name: string; monthlyCredits: number }
  upgradeAvailable: boolean
}

export type MetricTotals = Record<'impressions' | 'likes' | 'comments' | 'shares' | 'clicks', number>

export interface AnalyticsOverview {
  totals: MetricTotals
  engagement_rate: number
  by_platform: { platform: string; totals: MetricTotals; engagement_rate: number }[]
  top_posts: {
    id: string
    title: string
    status: string
    published_at: string | null
    totals: MetricTotals
    engagement_rate: number
  }[]
  post_counts: { draft: number; scheduled: number; published: number; total: number }
}

export interface AppNotification {
  id: string
  type: 'post_due' | 'low_credits' | 'onboarding'
  title: string
  body: string
  href: string
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export const fetchDashboardStats = () => api<DashboardStats>('/api/dashboard/stats')
export const fetchPostPerformance = () => api<DashboardPost[]>('/api/dashboard/performance')
export const fetchCreditUsage = () => api<CreditUsageSummary>('/api/dashboard/credits')
export const fetchAccountSummary = () => api<AccountSummaryData>('/api/dashboard/account')
export const fetchCreditBalance = () => api<CreditBalance>('/api/credits')
export const fetchCreditTransactions = (limit = 50) =>
  api<CreditTransaction[]>(`/api/credits?type=transactions&limit=${limit}`)
export const fetchAnalytics = () => api<AnalyticsOverview>('/api/analytics')
export const fetchNotifications = () => api<AppNotification[]>('/api/notifications')

export function fetchPosts(params: { status?: string; q?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  qs.set('limit', String(params.limit ?? 100))
  if (params.offset) qs.set('offset', String(params.offset))
  return api<Post[]>(`/api/posts?${qs}`)
}

export const fetchPost = (id: string) => api<PostDetail>(`/api/posts/${encodeURIComponent(id)}`)

export function createPost(input: {
  title?: string
  description?: string
  content?: string
  platforms?: string[]
  platform_variants?: Record<string, PlatformPost>
  media_urls?: string[]
  tone?: string
  scheduled_for?: string | null
  generated_by_ai?: boolean
}) {
  return api<Post>('/api/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function updatePost(id: string, input: Record<string, unknown>) {
  return api<Post>(`/api/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export const deletePost = (id: string) =>
  api<void>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })

export function markPublished(id: string, platforms: { platform: string; url?: string }[]) {
  return api<PostDetail>(`/api/posts/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ platforms }),
  })
}

export function recordMetrics(id: string, platform: string, metrics: Partial<MetricTotals>) {
  return api<PostDetail>(`/api/posts/${encodeURIComponent(id)}/metrics`, {
    method: 'POST',
    body: JSON.stringify({ platform, metrics }),
  })
}

export async function generateContent(data: ContentGenerationRequest): Promise<ContentGenerationResponse> {
  return api<ContentGenerationResponse>('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function generateImage(prompt: string): Promise<string> {
  const result = await api<{ image_url: string }>('/api/ai/image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
  return result.image_url
}

export async function addFeedback(data: AddFeedbackRequest): Promise<string> {
  const result = await api<{ id: string }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.id
}

export async function startCheckout(plan: string): Promise<string> {
  const { url } = await api<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
  return url
}

export async function openBillingPortal(): Promise<string> {
  const { url } = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
  return url
}

export const deleteAccount = () => api<void>('/api/account', { method: 'DELETE' })
