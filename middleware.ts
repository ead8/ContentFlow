import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require an authenticated session
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/generate',
  '/media',
  '/posts',
  '/analytics',
  '/settings',
  '/calendar',
  '/profile',
  '/billing',
  '/welcome',
  '/onboarding',
  '/setPassword',
  '/updatePassword',
]

// Routes that only make sense when logged out
const AUTH_PAGES = ['/login', '/signup']

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  // Also refreshes the session cookie when the access token has expired
  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  // API routes do their own auth checks and return JSON errors
  if (pathname.startsWith('/api/')) return res

  const isProtected = PROTECTED_PREFIXES.some((p) => matches(pathname, p))

  if (!session && isProtected) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    redirectUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  // Signed-in users skip the landing and auth pages
  if (session && (AUTH_PAGES.includes(pathname) || pathname === '/')) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/billing/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
