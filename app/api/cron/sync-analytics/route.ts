/*
  Refreshes engagement metrics for auto-published posts and takes a daily
  follower snapshot per connected account. Call it every few hours (see
  app/api/cron/publish/route.ts for scheduling without Vercel).
*/
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runAnalyticsSync } from '@/lib/social/analytics-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function checkCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  const header = request.headers.get('authorization') || ''
  const digest = (s: string) => createHash('sha256').update(s).digest()
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

async function handle(request: NextRequest) {
  const denied = checkCronAuth(request)
  if (denied) return denied

  try {
    const data = await runAnalyticsSync(50)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Cron analytics sync failed:', error)
    return NextResponse.json({ success: false, error: 'Analytics sync failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
