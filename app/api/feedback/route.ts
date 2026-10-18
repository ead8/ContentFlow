import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

/**
 * Submit in-app feedback.
 * Body: { rating?: number (0-5), feedback?: string, source?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const supabase = await createClient()

    const body = await request.json()
    const { rating, feedback, source } = body

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        rating: typeof rating === 'number' ? Math.max(0, Math.min(5, rating)) : 0,
        feedback_text: typeof feedback === 'string' ? feedback : '',
        source: typeof source === 'string' ? source : null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: { id: data.id } }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Error submitting feedback')
  }
}
