"use client"

import type { LucideIcon } from "lucide-react"
import { Facebook, Instagram, Linkedin, Music2, Twitter, Youtube, Globe } from "lucide-react"

/** Client-side view of a connected social account (GET /api/social-accounts). */
export interface AccountRow {
  id: string
  platform: string
  account_id: string
  account_name: string | null
  account_type: string | null
  avatar_url: string | null
  status: "active" | "expired" | "error"
  last_error: string | null
  is_default: boolean
  token_expires_at: string | null
  created_at: string
}

export interface PlatformInfo {
  platform: string
  slug: string
  label: string
  configured: boolean
}

export interface SocialAccountsData {
  accounts: AccountRow[]
  platforms: PlatformInfo[]
}

/** Fetch helper for the app's `{ success, data }` API envelope. */
export async function socialApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body?.data as T
}

export function fetchSocialAccounts(): Promise<SocialAccountsData> {
  return socialApi<SocialAccountsData>("/api/social-accounts").then((d) => ({
    accounts: d?.accounts ?? [],
    platforms: d?.platforms ?? [],
  }))
}

/** Mirrors PLATFORM_SLUGS in lib/social/types.ts (server-only module). */
export const PLATFORM_SLUG: Record<string, string> = {
  LinkedIn: "linkedin",
  Facebook: "facebook",
  Instagram: "instagram",
  "X-Twitter": "x",
  Tiktok: "tiktok",
  YouTube_Shorts: "youtube",
}

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  LinkedIn: Linkedin,
  Facebook: Facebook,
  Instagram: Instagram,
  "X-Twitter": Twitter,
  Tiktok: Music2,
  YouTube_Shorts: Youtube,
}

export function platformIcon(platform: string): LucideIcon {
  return PLATFORM_ICONS[platform] ?? Globe
}

export function connectUrl(slugOrPlatform: string, returnTo = "/settings"): string {
  const slug = PLATFORM_SLUG[slugOrPlatform] ?? slugOrPlatform
  return `/api/social/${encodeURIComponent(slug)}/connect?returnTo=${encodeURIComponent(returnTo)}`
}

/** The account used for auto-publishing on a platform: default, else newest active. */
export function publishingAccountFor(accounts: AccountRow[], platform: string): AccountRow | null {
  const active = accounts.filter((a) => a.platform === platform && a.status === "active")
  if (active.length === 0) return null
  return (
    active.find((a) => a.is_default) ??
    [...active].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  )
}
