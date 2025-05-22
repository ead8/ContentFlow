import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Check if the user is authenticated
  if (!session && (
    req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/generate') ||
    req.nextUrl.pathname.startsWith('/media') ||
    req.nextUrl.pathname.startsWith('/posts') ||
    req.nextUrl.pathname.startsWith('/analytics') ||
    req.nextUrl.pathname.startsWith('/settings')
  )) {
    // Redirect to login if accessing protected routes without authentication
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // For authenticated users, check role-based access
  if (session) {
    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    // If user role is not admin, restrict access to dashboard tools
    if (profile?.role !== 'admin' && (
      req.nextUrl.pathname.startsWith('/dashboard')
    )) {
      // Redirect to generate or show access denied
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/generate'
      return NextResponse.redirect(redirectUrl)
    }

    // Redirect authenticated users away from auth pages
    if (req.nextUrl.pathname === '/login' ||
        req.nextUrl.pathname === '/signup' ||
        req.nextUrl.pathname === '/') {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}

// Specify which routes this middleware should run for
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}