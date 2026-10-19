import type { Platform } from '@/lib/platforms'
import type { PlatformAdapter } from './types'
import { linkedinAdapter } from './platforms/linkedin'
import { facebookAdapter, instagramAdapter } from './platforms/meta'
import { xAdapter } from './platforms/x'
import { tiktokAdapter } from './platforms/tiktok'
import { youtubeAdapter } from './platforms/youtube'

const ADAPTERS: Record<Platform, PlatformAdapter> = {
  LinkedIn: linkedinAdapter,
  Facebook: facebookAdapter,
  Instagram: instagramAdapter,
  'X-Twitter': xAdapter,
  Tiktok: tiktokAdapter,
  YouTube_Shorts: youtubeAdapter,
}

export function getAdapter(platform: Platform): PlatformAdapter {
  return ADAPTERS[platform]
}

export function allAdapters(): PlatformAdapter[] {
  return Object.values(ADAPTERS)
}
