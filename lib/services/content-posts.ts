import { createClient } from '@/lib/supabase/server'

export interface ContentPost {
  id: string
  user_id: string
  title: string | null
  content: string
  media_urls: string[] | null
  content_type: string
  status: 'draft' | 'scheduled' | 'published'
  published_at: string | null
  scheduled_for: string | null
  tone: string
  language: string
  generated_by_ai: boolean
  credits_used: number
  created_at: string
  updated_at: string
}

/**
 * Create a new content post
 */
export async function createPost(
  content: string,
  options?: {
    title?: string
    media_urls?: string[]
    content_type?: string
    tone?: string
    language?: string
    scheduled_for?: string
    generated_by_ai?: boolean
    credits_used?: number
  }
): Promise<ContentPost> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('content_posts')
    .insert({
      user_id: user.id,
      content,
      title: options?.title,
      media_urls: options?.media_urls,
      content_type: options?.content_type || 'text',
      tone: options?.tone || 'professional',
      language: options?.language || 'en',
      scheduled_for: options?.scheduled_for,
      generated_by_ai: options?.generated_by_ai || false,
      credits_used: options?.credits_used || 0,
      status: options?.scheduled_for ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (error) throw error
  return data as ContentPost
}

/**
 * Get user's posts with optional filtering
 */
export async function getUserPosts(
  status?: string,
  limit = 20,
  offset = 0
): Promise<ContentPost[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  let query = supabase
    .from('content_posts')
    .select('*')
    .eq('user_id', user.id)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data as ContentPost[]
}

/**
 * Update a post
 */
export async function updatePost(
  postId: string,
  updates: Partial<ContentPost>
): Promise<ContentPost> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select()
    .single()

  if (error) throw error
  return data as ContentPost
}

/**
 * Publish a post to social accounts
 */
export async function publishPost(
  postId: string,
  targetAccountIds: string[]
): Promise<void> {
  const supabase = await createClient()

  // Create post targets for each account
  const postTargets = targetAccountIds.map(accountId => ({
    post_id: postId,
    social_account_id: accountId,
    platform: '', // Will be set based on account
    status: 'pending',
  }))

  const { error } = await supabase
    .from('post_targets')
    .insert(postTargets)

  if (error) throw error

  // Update post status to published
  await updatePost(postId, {
    status: 'published',
    published_at: new Date().toISOString(),
  })
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('content_posts')
    .delete()
    .eq('id', postId)

  if (error) throw error
}
