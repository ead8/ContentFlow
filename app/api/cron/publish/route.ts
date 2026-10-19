/*
  Publishes due scheduled posts and due retries. Call it every minute.

  On Vercel, vercel.json schedules it and Vercel sends
  `Authorization: Bearer $CRON_SECRET` automatically.

  Self-hosting without Vercel: schedule it from Supabase with pg_cron +
  pg_net (enable both extensions under Database > Extensions), replacing the
  URL and secret:

    select cron.schedule(
      'contentflow-publish',
      '* * * * *',
      $$
      select net.http_post(
        url := 'https://your-app.example.com/api/cron/publish',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_CRON_SECRET'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
      $$
    );

    select cron.schedule(
      'contentflow-sync-analytics',
      '0 0,6,12,18 * * *',  -- every 6 hours
      $$
      select net.http_post(
        url := 'https://your-app.example.com/api/cron/sync-analytics',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_CRON_SECRET'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
      $$
    );

  To stop: select cron.unschedule('contentflow-publish');
  Any other scheduler works too, e.g.
    curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.example.com/api/cron/publish
*/
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runPublishCycle } from '@/lib/social/publisher'

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
    const data = await runPublishCycle()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Cron publish failed:', error)
    return NextResponse.json({ success: false, error: 'Publish cycle failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
