import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { cancelSubscriptionsForUser } from '@/lib/billing/stripe'
import { apiError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/account -> permanently delete the current user's account:
 * cancels any Stripe subscription, removes uploaded media, then deletes the
 * auth user (all database rows cascade).
 */
export async function DELETE() {
  try {
    const userId = await requireUserId()
    const supabase = createClient()

    await cancelSubscriptionsForUser(userId)

    // Remove the user's media files (storage objects don't cascade)
    for (const folder of [userId, `${userId}/generated`, `${userId}/uploads`]) {
      const { data: files } = await supabase.storage.from('media').list(folder, { limit: 1000 })
      const paths = (files || []).filter((f) => f.id).map((f) => `${folder}/${f.name}`)
      if (paths.length) await supabase.storage.from('media').remove(paths)
    }

    const { error } = await supabase.rpc('delete_my_account')
    if (error) throw error

    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error deleting account')
  }
}
