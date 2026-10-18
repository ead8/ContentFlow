import { NextRequest, NextResponse } from 'next/server'
import { generateImageUrl } from '@/lib/ai/openai'
import { deductCredits } from '@/lib/services/credits'
import { requireUserId } from '@/lib/services/auth'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/error'

const CREDIT_COST = 25

/**
 * Generate an image with AI.
 * Body: { prompt: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()

    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Prompt must be at least 5 characters' },
        { status: 400 }
      )
    }

    const imageUrl = await generateImageUrl(prompt.trim())

    // Charge only after successful generation, and track pool usage
    await deductCredits(CREDIT_COST, 'AI image generation')

    const supabase = await createClient()
    const { data: usage } = await supabase
      .from('usage')
      .select('image_credits_used')
      .eq('user_id', userId)
      .single()

    if (usage) {
      await supabase
        .from('usage')
        .update({
          image_credits_used: (usage.image_credits_used || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    }

    return NextResponse.json({ success: true, data: { image_url: imageUrl } })
  } catch (error) {
    return apiError(error, 'Error generating image')
  }
}
