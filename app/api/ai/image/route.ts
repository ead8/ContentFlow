import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { generateImage } from '@/lib/ai/openai'
import { assertCanAfford, spendCredits } from '@/lib/services/credits'
import { requireUserId } from '@/lib/services/auth'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/error'

// Image providers can take a while
export const maxDuration = 60

/**
 * Generate an image with AI and store it in the user's media folder.
 * Body: { prompt: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()

    const body = await request.json().catch(() => ({}))
    const { prompt } = body

    if (typeof prompt !== 'string' || prompt.trim().length < 5 || prompt.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Prompt must be between 5 and 1000 characters' },
        { status: 400 }
      )
    }

    await assertCanAfford('image')

    const image = await generateImage(prompt.trim())

    // Provider URLs expire (e.g. DALL-E links last ~1 hour), so keep our own copy
    const supabase = createClient()
    const path = `${userId}/generated/${randomUUID()}.${image.extension}`
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(path, image.bytes, { contentType: image.contentType, upsert: false })

    if (uploadError) throw new Error(`Could not store generated image: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)

    // Charge only after the image exists
    await spendCredits('image', 'AI image generation')

    return NextResponse.json({ success: true, data: { image_url: publicUrl } })
  } catch (error) {
    return apiError(error, 'Error generating image')
  }
}
