import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

/**
 * Password-reset email link: exchange the code for a session, then let the
 * user choose a new password.
 */
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies: () => cookies() })
  const code = new URL(req.url).searchParams.get('code')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL('/updatePassword', req.url))
    }
  }

  return NextResponse.redirect(new URL('/resetPassword?error=expired', req.url))
}
