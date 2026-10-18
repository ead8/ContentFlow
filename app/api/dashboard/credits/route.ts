import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Credit pool usage for the dashboard Credit Usage widget.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('usage')
      .select('image_credits_used, video_credits_used, total_image_credits, total_video_credits')
      .eq('user_id', userId)
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return apiError(error, 'Error fetching credit usage')
  }
}
