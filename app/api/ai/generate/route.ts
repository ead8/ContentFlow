import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/lib/ai/openai'
import { assertCanAfford, spendCredits } from '@/lib/services/credits'
import { requireUserId } from '@/lib/services/auth'
import { apiError } from '@/lib/api/error'
import { PLATFORMS, TONES } from '@/lib/platforms'

export const dynamic = 'force-dynamic'
// Generation plus, at worst, waiting out a provider rate limit
export const maxDuration = 120

/**
 * Generate platform-tailored social content with AI.
 * Body: { platform: string[], prompt: string, tone: string, audience?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await requireUserId()

    const body = await request.json().catch(() => ({}))
    const { platform, prompt, tone, audience } = body

    if (
      !Array.isArray(platform) ||
      platform.length === 0 ||
      !platform.every((p: unknown) => typeof p === 'string' && (PLATFORMS as readonly string[]).includes(p))
    ) {
      return NextResponse.json(
        { success: false, error: `Choose at least one platform from: ${PLATFORMS.join(', ')}` },
        { status: 400 }
      )
    }
    if (typeof prompt !== 'string' || prompt.trim().length < 5 || prompt.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Prompt must be between 5 and 2000 characters' },
        { status: 400 }
      )
    }
    if (tone !== undefined && !(TONES as readonly string[]).includes(tone)) {
      return NextResponse.json(
        { success: false, error: `Tone must be one of: ${TONES.join(', ')}` },
        { status: 400 }
      )
    }
    if (audience !== undefined && (typeof audience !== 'string' || audience.length > 200)) {
      return NextResponse.json(
        { success: false, error: 'Audience must be at most 200 characters' },
        { status: 400 }
      )
    }

    // Refuse early instead of paying for generations the user can't afford
    await assertCanAfford('text')

    const result = await generateContentIdeas({
      platforms: Array.from(new Set(platform as string[])),
      prompt: prompt.trim(),
      tone: tone || 'Professional',
      audience: audience?.trim() || '',
    })

    // Charge only after successful generation
    await spendCredits('text', 'AI content generation')

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'Error generating content')
  }
}
