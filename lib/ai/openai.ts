import type { ContentGenerationResponse } from '@/models/content'

// Any OpenAI-compatible provider works here, e.g.:
//   - OpenAI:            https://api.openai.com/v1            (needs OPENAI_API_KEY)
//   - OpenRouter:        https://openrouter.ai/api/v1        (free :free models, free key, no card)
//   - Pollinations:      https://text.pollinations.ai/openai (no key needed at all)
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3'
const IS_POLLINATIONS = BASE_URL.includes('pollinations.ai')

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key && !process.env.OPENAI_BASE_URL) {
    throw new Error('AI generation is not configured. Set OPENAI_API_KEY in your environment.')
  }
  // Keyless providers (e.g. Pollinations) don't need one.
  return key || ''
}

function authHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

const PLATFORM_GUIDANCE: Record<string, string> = {
  'LinkedIn': 'professional long-form post, up to 3000 characters, no more than 5 hashtags',
  'Instagram': 'engaging caption up to 2200 characters with emojis and up to 15 hashtags',
  'X-Twitter': 'punchy post under 280 characters with up to 3 hashtags',
  'YouTube_Shorts': 'video title and description optimized for Shorts discovery',
  'Facebook': 'conversational post up to 2000 characters with a question to drive comments',
  'Tiktok': 'short energetic caption under 300 characters with trending-style hashtags',
}

export interface GenerateInput {
  platforms: string[]
  prompt: string
  tone: string
  audience: string
}

/**
 * Generate platform-tailored social content with OpenAI.
 * Returns the ContentGenerationResponse shape the wizard expects.
 */
export async function generateContentIdeas(input: GenerateInput): Promise<ContentGenerationResponse> {
  const key = apiKey()

  const platformInstructions = input.platforms
    .map((p) => `- ${p}: ${PLATFORM_GUIDANCE[p] || 'engaging social media post'}`)
    .join('\n')

  const system = `You are ContentFlow, an expert social media copywriter. Generate high-quality, ready-to-publish content.

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "name": "short campaign title",
  "description": "one-sentence summary of the campaign angle",
  "platform_posts": {
    "<PlatformName>": {
      "post": "the full post text",
      "caption": "caption variant where relevant",
      "hashtags": ["tag1", "tag2"],
      "emojis": ["🔥"],
      "call_to_action": "short CTA",
      "image_suggestion": "brief description of an ideal accompanying image"
    }
  }
}

Rules:
- Include exactly these platforms: ${input.platforms.join(', ')}
- Tone: ${input.tone}
- Target audience: ${input.audience || 'a general audience'}
- Write in the brand voice implied by the prompt; never include placeholder text like [Your Brand].
${platformInstructions}`

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify({
      model: TEXT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.8,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input.prompt },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI generation failed (${res.status}). ${detail.slice(0, 200)}`)
  }

  const json = await res.json()
  const raw = json.choices?.[0]?.message?.content
  if (!raw) throw new Error('AI generation returned an empty response.')

  let parsed: ContentGenerationResponse
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI generation returned invalid JSON.')
  }

  if (!parsed.name || !parsed.description || !parsed.platform_posts) {
    throw new Error('AI generation returned an incomplete response.')
  }

  return parsed
}

/**
 * Generate an image with OpenAI and return its URL.
 */
export async function generateImageUrl(prompt: string): Promise<string> {
  const key = apiKey()

  // Pollinations has no OpenAI-style /images/generations endpoint; it serves
  // images from a keyless URL API instead, so route through it directly.
  if (IS_POLLINATIONS) {
    const q = encodeURIComponent(`Social media creative, high quality, no text overlays: ${prompt}`)
    return `https://image.pollinations.ai/prompt/${q}?width=1024&height=1024&nologo=true&model=flux`
  }

  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: `Social media creative, high quality, no text overlays: ${prompt}`,
      size: '1024x1024',
      n: 1,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Image generation failed (${res.status}). ${detail.slice(0, 200)}`)
  }

  const json = await res.json()
  const url = json.data?.[0]?.url
  if (!url) throw new Error('Image generation returned no URL.')
  return url
}
