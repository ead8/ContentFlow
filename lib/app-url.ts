import type { NextRequest } from 'next/server'

/** Public base URL of the app, for redirects (Stripe, auth emails) */
export function appUrl(request?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configured) return configured
  if (request) return new URL(request.url).origin
  return 'http://localhost:3000'
}
