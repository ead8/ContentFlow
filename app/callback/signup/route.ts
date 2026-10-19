import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

/**
 * Sign-up email link (alternative to typing the code): exchange the code for
 * a session, then continue to choosing a password.
 */
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies: () => cookies() })
  const code = new URL(req.url).searchParams.get('code')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL('/setPassword', req.url))
    }
  }

  return NextResponse.redirect(new URL('/signup?error=expired', req.url))
}
