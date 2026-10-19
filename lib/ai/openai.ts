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
 * Generate platform-tailored social content with an OpenAI-compatible API.
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
    signal: AbortSignal.timeout(90_000),
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
    console.error(`AI text generation failed (${res.status}):`, detail.slice(0, 500))
    throw new Error(`AI generation failed (${res.status}). Please try again.`)
  }

  const json = await res.json()
  const raw: string | undefined = json.choices?.[0]?.message?.content
  if (!raw) throw new Error('AI generation returned an empty response. Please try again.')

  const parsed = parseJsonObject(raw) as ContentGenerationResponse | null
  if (!parsed?.platform_posts || typeof parsed.platform_posts !== 'object') {
    throw new Error('AI generation returned an incomplete response. Please try again.')
  }

  // Keep only the requested platforms and normalise the fields the UI edits
  const platform_posts: ContentGenerationResponse['platform_posts'] = {}
  for (const platform of input.platforms) {
    const post = parsed.platform_posts[platform]
    if (!post) continue
    platform_posts[platform] = {
      ...post,
      post: typeof post.post === 'string' ? post.post : post.caption || '',
      hashtags: Array.isArray(post.hashtags)
        ? post.hashtags.map((h) => String(h).replace(/^#+/, '').trim()).filter(Boolean)
        : [],
    }
  }

  if (Object.keys(platform_posts).length === 0) {
    throw new Error('AI generation returned no posts for the selected platforms. Please try again.')
  }

  return {
    name: parsed.name || 'Untitled campaign',
    description: parsed.description || '',
    platform_posts,
    additional_notes: parsed.additional_notes,
  }
}

/** Parse a JSON object from model output, tolerating code fences/prose */
function parseJsonObject(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first === -1 || last <= first) return null
    try {
      return JSON.parse(cleaned.slice(first, last + 1))
    } catch {
      return null
    }
  }
}

export interface GeneratedImage {
  bytes: ArrayBuffer
  contentType: string
  extension: string
}

const IMAGE_PROMPT_PREFIX = 'Social media creative, high quality, no text overlays: '

/**
 * Generate an image and return its bytes, so the caller can store a
 * permanent copy (provider URLs are often temporary).
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const key = apiKey()

  // Pollinations has no OpenAI-style /images/generations endpoint; it serves
  // images from a keyless URL API instead.
  if (IS_POLLINATIONS) {
    const q = encodeURIComponent(`${IMAGE_PROMPT_PREFIX}${prompt}`)
    return downloadImage(
      `https://image.pollinations.ai/prompt/${q}?width=1024&height=1024&nologo=true&model=flux`
    )
  }

  // dall-e models accept response_format; gpt-image models always return base64
  const isDallE = IMAGE_MODEL.startsWith('dall-e')
  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: authHeaders(key),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: `${IMAGE_PROMPT_PREFIX}${prompt}`,
      size: '1024x1024',
      n: 1,
      ...(isDallE ? { response_format: 'b64_json' } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`AI image generation failed (${res.status}):`, detail.slice(0, 500))
    throw new Error(`Image generation failed (${res.status}). Please try again.`)
  }

  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) {
    const buf = Buffer.from(item.b64_json, 'base64')
    return {
      bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      contentType: 'image/png',
      extension: 'png',
    }
  }
  if (item?.url) return downloadImage(item.url)

  throw new Error('Image generation returned no image. Please try again.')
}

async function downloadImage(url: string): Promise<GeneratedImage> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`Image generation failed (${res.status}). Please try again.`)

  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  if (!contentType.startsWith('image/')) {
    throw new Error('Image generation returned an unexpected response. Please try again.')
  }

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  return { bytes: await res.arrayBuffer(), contentType, extension }
}
