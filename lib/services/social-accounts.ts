import { createClient } from '@/lib/supabase/server'

export interface SocialAccount {
  id: string
  user_id: string
  platform: 'linkedin' | 'instagram' | 'x' | 'youtube' | 'tiktok' | 'facebook'
  account_id: string
  account_name: string
  is_connected: boolean
  last_synced: string | null
  created_at: string
}

/**
 * Add a new social media account
 */
export async function addSocialAccount(
  platform: SocialAccount['platform'],
  accountId: string,
  accountName: string,
  accessToken: string,
  refreshToken?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('social_accounts')
    .insert({
      user_id: user.id,
      platform,
      account_id: accountId,
      account_name: accountName,
      access_token: accessToken,
      refresh_token: refreshToken,
      is_connected: true,
    })
    .select()
    .single()

  if (error) throw error
  return data as SocialAccount
}

/**
 * Get all connected social accounts for user
 */
export async function getUserSocialAccounts(): Promise<SocialAccount[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as SocialAccount[]
}

/**
 * Disconnect a social account
 */
export async function disconnectSocialAccount(accountId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('social_accounts')
    .update({ is_connected: false })
    .eq('id', accountId)

  if (error) throw error
}

/**
 * Update last_synced timestamp
 */
export async function updateAccountSyncTime(accountId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('social_accounts')
    .update({ last_synced: new Date().toISOString() })
    .eq('id', accountId)

  if (error) throw error
}
