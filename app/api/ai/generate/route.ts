import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/lib/ai/openai'
import { deductCredits } from '@/lib/services/credits'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'

const CREDIT_COST = 10

/**
 * Generate platform-tailored social content with AI.
 * Body: { platform: string[], prompt: string, tone: string, audience?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireUserId()

    const body = await request.json()
    const { platform, prompt, tone, audience } = body

    if (!Array.isArray(platform) || platform.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one platform is required' },
        { status: 400 }
      )
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Prompt must be at least 5 characters' },
        { status: 400 }
      )
    }

    const result = await generateContentIdeas({
      platforms: platform,
      prompt: prompt.trim(),
      tone: tone || 'Professional',
      audience: audience || '',
    })

    // Charge only after successful generation
    await deductCredits(CREDIT_COST, 'AI content generation')

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'Error generating content')
  }
}
