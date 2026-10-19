import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses Row Level Security, so only use it
 * in trusted server code that does not act on behalf of a user session
 * (e.g. the Stripe webhook).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
