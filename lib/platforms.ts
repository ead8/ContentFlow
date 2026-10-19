/** Platforms the content wizard can write for */
export const PLATFORMS = [
  'LinkedIn',
  'Instagram',
  'X-Twitter',
  'Facebook',
  'Tiktok',
  'YouTube_Shorts',
] as const

export type Platform = (typeof PLATFORMS)[number]

export const TONES = ['Professional', 'Casual', 'Enthusiastic', 'Informative'] as const

export type Tone = (typeof TONES)[number]

export const PLATFORM_LABELS: Record<Platform, string> = {
  LinkedIn: 'LinkedIn',
  Instagram: 'Instagram',
  'X-Twitter': 'X (Twitter)',
  Facebook: 'Facebook',
  Tiktok: 'TikTok',
  YouTube_Shorts: 'YouTube Shorts',
}

export function platformLabel(p: string): string {
  return PLATFORM_LABELS[p as Platform] ?? p
}

/** Character limits used to warn users while editing */
export const PLATFORM_CHAR_LIMITS: Partial<Record<Platform, number>> = {
  LinkedIn: 3000,
  Instagram: 2200,
  'X-Twitter': 280,
  Facebook: 63206,
  Tiktok: 2200,
  YouTube_Shorts: 5000,
}

/**
 * Where to send the user to publish. Platforms with a public share intent get
 * the text pre-filled; the rest open the platform's composer and the user
 * pastes the copied text.
 */
export function composerUrl(platform: string, text: string): string {
  const t = encodeURIComponent(text)
  switch (platform) {
    case 'X-Twitter':
      return `https://x.com/intent/tweet?text=${t}`
    case 'LinkedIn':
      return `https://www.linkedin.com/feed/?shareActive=true&text=${t}`
    case 'Facebook':
      return 'https://www.facebook.com/'
    case 'Instagram':
      return 'https://www.instagram.com/'
    case 'Tiktok':
      return 'https://www.tiktok.com/upload'
    case 'YouTube_Shorts':
      return 'https://studio.youtube.com/'
    default:
      return '#'
  }
}

/** Full text for a platform: post + call to action + hashtags */
export function composeVariantText(v: {
  post?: string
  caption?: string
  call_to_action?: string
  hashtags?: string[]
}): string {
  const body = (v.post || v.caption || '').trim()
  const cta = v.call_to_action?.trim()
  const tags = (v.hashtags || [])
    .map((h) => h.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .map((h) => `#${h}`)
    .join(' ')

  return [body, cta && !body.includes(cta) ? cta : '', tags].filter(Boolean).join('\n\n')
}
