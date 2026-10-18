import { createClient } from '@/lib/supabase/server'

/**
 * Resolve the current authenticated user's id, or throw if there is no
 * session. Service functions call this first so unauthenticated requests
 * fail fast instead of hitting the database.
 */
export async function requireUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')
  return user.id
}
