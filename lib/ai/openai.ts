import type { ContentGenerationResponse } from '@/models/content'

/**
 * AI provider configuration. Any OpenAI-compatible API works; AI_PROVIDER
 * picks sensible defaults and explicit OPENAI_* variables always win:
 *
 *   openai       production; needs OPENAI_API_KEY
 *   openrouter   many models behind one key; needs OPENAI_API_KEY
 *                (OpenRouter has no image API: set OPENAI_IMAGE_BASE_URL/KEY
 *                to an image-capable provider, or images are unavailable)
 *   pollinations keyless, for demos only (about 1 reply / 30 s per IP)
 *   custom       anything else; needs OPENAI_BASE_URL
 *
 * Without AI_PROVIDER: pollinations if OPENAI_BASE_URL points at it, custom
 * if another OPENAI_BASE_URL is set, otherwise openai.
 */
type AiProvider = 'openai' | 'openrouter' | 'pollinations' | 'custom'

const PRESETS: Record<AiProvider, { baseUrl?: string; textModel: string; imageModel: string; keyless?: boolean }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', textModel: 'gpt-4o-mini', imageModel: 'dall-e-3' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', textModel: 'openai/gpt-4o-mini', imageModel: '' },
  pollinations: { baseUrl: 'https://text.pollinations.ai/openai', textModel: 'openai', imageModel: 'flux', keyless: true },
  custom: { textModel: 'gpt-4o-mini', imageModel: 'dall-e-3' },
}

function resolveProvider(): AiProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (explicit && explicit in PRESETS) return explicit as AiProvider
  const base = process.env.OPENAI_BASE_URL || ''
  if (base.includes('pollinations.ai')) return 'pollinations'
  if (base) return 'custom'
  return 'openai'
}

const PROVIDER = resolveProvider()
const PRESET = PRESETS[PROVIDER]
const BASE_URL = (process.env.OPENAI_BASE_URL || PRESET.baseUrl || '').replace(/\/$/, '')
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || PRESET.textModel
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || PRESET.imageModel
const IS_POLLINATIONS = BASE_URL.includes('pollinations.ai')
const IMAGE_BASE_URL = (process.env.OPENAI_IMAGE_BASE_URL || BASE_URL).replace(/\/$/, '')

const NOT_CONFIGURED = 'AI generation is not configured. Please contact support.'

/** Provider summary for health checks (no secrets) */
export function aiConfig() {
  const keyless = PRESET.keyless || IS_POLLINATIONS
  return {
    provider: PROVIDER,
    baseUrl: BASE_URL,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL || null,
    configured: Boolean(BASE_URL) && (keyless || Boolean(process.env.OPENAI_API_KEY)),
    demoOnly: keyless,
  }
}

function apiKey(): string {
  const cfg = aiConfig()
  if (!cfg.configured) {
    console.error(`AI provider "${PROVIDER}" is missing configuration (OPENAI_API_KEY / OPENAI_BASE_URL).`)
    throw new Error(NOT_CONFIGURED)
  }
  return process.env.OPENAI_API_KEY || ''
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

  // Retry transient provider errors (429/5xx) and occasional malformed JSON
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await requestCompletion(key, system, input.prompt)
      return normalizeGeneration(raw, input.platforms)
    } catch (err) {
      lastError = err as Error
      if (!(err instanceof MalformedResponseError || err instanceof TransientProviderError)) break
      if (attempt < 3) {
        const hinted = err instanceof TransientProviderError ? err.retryAfterMs : undefined
        if (hinted !== undefined && hinted > MAX_RATE_LIMIT_WAIT_MS) break
        await new Promise((r) => setTimeout(r, hinted !== undefined ? hinted + 500 : attempt * 1500))
      }
    }
  }
  throw lastError ?? new Error('AI generation failed. Please try again.')
}

class MalformedResponseError extends Error {}
class TransientProviderError extends Error {
  constructor(message: string, readonly retryAfterMs?: number) {
    super(message)
  }
}

/** Longest rate-limit wait we absorb inside one request */
const MAX_RATE_LIMIT_WAIT_MS = 35_000

/** Retry-After header (seconds or HTTP date), or "retry after Ns" in the body */
function retryAfterMs(res: Response, body: string): number | undefined {
  const header = res.headers.get('retry-after')
  if (header) {
    const secs = Number(header)
    if (Number.isFinite(secs)) return secs * 1000
    const at = Date.parse(header)
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now())
  }
  const m = body.match(/retry after (\d+)\s*s/i)
  return m ? Number(m[1]) * 1000 : undefined
}

async function requestCompletion(key: string, system: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(key),
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: TEXT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.8,
      // A fresh seed avoids providers returning the same cached reply on retry
      seed: Math.floor(Math.random() * 1_000_000),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`AI text generation failed (${res.status}):`, detail.slice(0, 500))
    const message = `AI generation failed (${res.status}). Please try again.`
    const wait = retryAfterMs(res, detail)
    // Rate limits (429, or 402 "free limit" from keyless providers) say when to come back
    const rateLimited = res.status === 429 || (res.status === 402 && /limit/i.test(detail))
    if (rateLimited || res.status >= 500) throw new TransientProviderError(message, wait)
    throw new Error(message)
  }

  const json = await res.json()
  const raw: string | undefined = json.choices?.[0]?.message?.content
  if (!raw) throw new MalformedResponseError('AI generation returned an empty response. Please try again.')
  return raw
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** Accept a few spellings models use for platform keys */
const PLATFORM_ALIASES: Record<string, string[]> = {
  'X-Twitter': ['xtwitter', 'twitter', 'x', 'twitterx'],
  YouTube_Shorts: ['youtubeshorts', 'youtube', 'shorts'],
  Tiktok: ['tiktok'],
  LinkedIn: ['linkedin'],
  Instagram: ['instagram'],
  Facebook: ['facebook'],
}

function normalizeGeneration(raw: string, platforms: string[]): ContentGenerationResponse {
  const parsed = parseJsonObject(raw) as Record<string, any> | null
  if (!parsed || typeof parsed !== 'object') {
    console.error('AI returned unparseable output:', raw.slice(0, 500))
    throw new MalformedResponseError('AI generation returned an incomplete response. Please try again.')
  }

  // Posts are normally under platform_posts, but some models put them at the top level
  const source: Record<string, any> =
    parsed.platform_posts && typeof parsed.platform_posts === 'object' ? parsed.platform_posts : parsed

  const byKey = new Map(Object.entries(source).map(([k, v]) => [simplify(k), v]))

  const platform_posts: ContentGenerationResponse['platform_posts'] = {}
  for (const platform of platforms) {
    const keys = [simplify(platform), ...(PLATFORM_ALIASES[platform] || [])]
    let post = keys.map((k) => byKey.get(k)).find((v) => v)
    if (typeof post === 'string') post = { post }
    if (!post || typeof post !== 'object') continue

    const text = [post.post, post.caption, post.text, post.content, post.description].find(
      (v) => typeof v === 'string' && v.trim()
    )
    if (!text) continue

    platform_posts[platform] = {
      ...post,
      post: text,
      hashtags: Array.isArray(post.hashtags)
        ? post.hashtags.map((h: unknown) => String(h).replace(/^#+/, '').trim()).filter(Boolean)
        : typeof post.hashtags === 'string'
          ? post.hashtags.split(/[\s,]+/).map((h: string) => h.replace(/^#+/, '').trim()).filter(Boolean)
          : [],
    }
  }

  if (Object.keys(platform_posts).length === 0) {
    console.error('AI output had no usable posts:', raw.slice(0, 500))
    throw new MalformedResponseError('AI generation returned an incomplete response. Please try again.')
  }

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Untitled campaign',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    platform_posts,
    additional_notes: parsed.additional_notes,
  }
}

/** Parse a JSON object from model output, tolerating code fences, prose and sloppy escaping */
function parseJsonObject(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  const candidates = [cleaned]
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1))

  for (const c of candidates) {
    for (const text of [c, repairJson(c)]) {
      try {
        return JSON.parse(text)
      } catch {
        // try the next variant
      }
    }
  }
  return null
}

/**
 * Fix the most common ways models break JSON inside string literals:
 * raw newlines / tabs / control characters and invalid backslash escapes.
 */
function repairJson(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      continue
    }
    if (ch === '\\') {
      const next = text[i + 1]
      if (next !== undefined && '"\\/bfnrtu'.includes(next)) {
        out += ch + next
        i++
      } else if (next === '\n' || next === '\r') {
        // backslash + line break: keep it as an escaped newline
        out += '\\n'
        i++
        if (next === '\r' && text[i + 1] === '\n') i++
      } else {
        out += '\\\\'
      }
      continue
    }
    if (ch === '"') {
      inString = false
      out += ch
    } else if (ch === '\n') out += '\\n'
    else if (ch === '\r') continue
    else if (ch === '\t') out += '\\t'
    else if (ch.charCodeAt(0) < 0x20) out += ' '
    else out += ch
  }
  return out
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
  if (!IMAGE_MODEL) {
    throw new Error('Image generation is not available with the current AI provider. Upload an image instead.')
  }
  const imageKey = process.env.OPENAI_IMAGE_API_KEY || key
  const isDallE = IMAGE_MODEL.startsWith('dall-e')
  const res = await fetch(`${IMAGE_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: authHeaders(imageKey),
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
