import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiConfig } from '@/lib/ai/openai'
import { emailProvider, isEmailConfigured } from '@/lib/email'
import { isBillingConfigured } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') || ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const a = createHash('sha256').update(header.slice(7)).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

/**
 * GET /api/health -> { ok } for uptime monitors.
 * With "Authorization: Bearer $CRON_SECRET" also reports which subsystems are
 * configured (never secrets).
 */
export async function GET(request: NextRequest) {
  let database = false
  try {
    const { error } = await createAdminClient().from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
    database = !error
  } catch {
    database = false
  }

  if (!authorized(request)) {
    return NextResponse.json({ ok: database }, { status: database ? 200 : 503 })
  }

  const ai = aiConfig()
  return NextResponse.json(
    {
      ok: database,
      database,
      ai: { provider: ai.provider, configured: ai.configured, demoOnly: ai.demoOnly, textModel: ai.textModel },
      email: { provider: emailProvider(), delivering: isEmailConfigured() },
      billing: isBillingConfigured(),
      publishing: {
        encryptionKey: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        cronSecret: Boolean(process.env.CRON_SECRET),
      },
    },
    { status: database ? 200 : 503 }
  )
}
