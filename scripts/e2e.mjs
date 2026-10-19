#!/usr/bin/env node
/**
 * End-to-end test against a running app + local Supabase stack.
 *
 *   npx supabase start
 *   npm run dev            (or npm run build && npm start)
 *   npm run test:e2e
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY from .env.local. Uses the local Mailpit inbox to
 * read sign-up codes, so it must NOT be pointed at a production project.
 *
 * Options (env): APP_URL (default http://localhost:3000),
 *                MAILPIT_URL (default http://127.0.0.1:54324),
 *                SKIP_AI=1 to skip the calls that hit the AI provider.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createCipheriv, randomBytes } from 'node:crypto'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const env = { ...process.env }
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2]
  }
}

const APP = (env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const SB = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const MAILPIT = (env.MAILPIT_URL || 'http://127.0.0.1:54324').replace(/\/$/, '')
const SKIP_AI = env.SKIP_AI === '1'
const CRON_SECRET = env.CRON_SECRET
const TOKEN_KEY = env.TOKEN_ENCRYPTION_KEY ? Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64') : null

if (!SB || !ANON || !SERVICE) {
  console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(2)
}
if (!/127\.0\.0\.1|localhost/.test(SB)) {
  console.error(`Refusing to run against non-local Supabase (${SB})`)
  process.exit(2)
}

const COOKIE_NAME = `sb-${new URL(SB).hostname.split('.')[0]}-auth-token`

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------
let passed = 0
const failures = []

async function test(name, fn) {
  const started = Date.now()
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name} (${Date.now() - started}ms)`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  ✗ ${name}\n      ${err?.message || err}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function section(title) {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}

/** Call a Next.js API route as a user (session cookie) */
async function app(user, path, { method = 'GET', body, redirect = 'follow', timeout = 60_000 } = {}) {
  const headers = {}
  if (user) {
    const value = encodeURIComponent(JSON.stringify([user.access_token, user.refresh_token, null, null, null]))
    headers.cookie = `${COOKIE_NAME}=${value}`
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${APP}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect,
    signal: AbortSignal.timeout(timeout),
  })
  return { status: res.status, headers: res.headers, body: redirect === 'manual' ? null : await json(res) }
}

/** Call Supabase REST/Auth/Storage directly, as a user or as the service role */
async function sb(path, { method = 'GET', token, key = ANON, body, headers = {}, raw } = {}) {
  const res = await fetch(`${SB}${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${token || key}`,
      ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  return { status: res.status, body: await json(res) }
}

const admin = (path, opts = {}) => sb(path, { ...opts, key: SERVICE, token: SERVICE })

async function getProfile(userId) {
  const { body } = await admin(`/rest/v1/profiles?id=eq.${userId}&select=*`)
  return body[0]
}

/** Read the newest 6-digit code sent to an address from Mailpit */
async function readCode(email, notBefore) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const list = await res.json()
    const msg = (list.messages || []).find((m) => new Date(m.Created).getTime() >= notBefore - 2000)
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()
      const code = `${full.Text || ''} ${full.HTML || ''}`.match(/\b(\d{6})\b/)
      if (code) return { code: code[1], subject: full.Subject }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No sign-up code email for ${email}`)
}

/** Sign up through the same OTP flow the app uses and return a session */
async function signUp(label) {
  const email = `e2e-${label}-${Date.now()}@example.test`
  const sentAt = Date.now()
  const otp = await sb('/auth/v1/otp', {
    method: 'POST',
    body: { email, create_user: true, data: { full_name: `E2E ${label}`, user_type: 'Creator' } },
  })
  eq(otp.status, 200, `send code (${JSON.stringify(otp.body)})`)

  const { code, subject } = await readCode(email, sentAt)
  const verify = await sb('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } })
  eq(verify.status, 200, `verify code (${JSON.stringify(verify.body)})`)

  const s = verify.body
  return { email, id: s.user.id, access_token: s.access_token, refresh_token: s.refresh_token, subject }
}


/** Same format as lib/social/crypto.ts: v1:iv:tag:ciphertext (base64) */
function encryptToken(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', TOKEN_KEY, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':')
}

async function cron(path, secret = CRON_SECRET) {
  const res = await fetch(`${APP}${path}`, {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(300_000),
  })
  return { status: res.status, body: await json(res) }
}

/** Newest email to an address after a time (optionally matching a subject), or null */
async function findEmail(email, notBefore, subjectRe) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    const list = await res.json()
    const msg = (list.messages || []).find(
      (m) => new Date(m.Created).getTime() >= notBefore - 2000 && (!subjectRe || subjectRe.test(m.Subject))
    )
    if (msg) return msg
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

/** Create a post, then move its schedule into the past (the API refuses past times) */
async function duePost(user, platforms, extra = {}) {
  const created = await app(user, '/api/posts', {
    method: 'POST',
    body: {
      title: `Due post ${Date.now()}`,
      platforms,
      platform_variants: Object.fromEntries(platforms.map((p) => [p, { post: `Hello from ${p}`, hashtags: ['test'] }])),
      scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  })
  eq(created.status, 201, `create due post (${JSON.stringify(created.body)})`)
  const id = created.body.data.id
  const past = new Date(Date.now() - 60 * 1000).toISOString()
  await admin(`/rest/v1/content_posts?id=eq.${id}`, { method: 'PATCH', body: { scheduled_for: past, ...extra } })
  return id
}

/** Insert a connected account with an encrypted (fake) token */
async function insertAccount(user, platform, { expiresInSec, refresh = false }) {
  const res = await admin('/rest/v1/social_accounts', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: {
      user_id: user.id,
      platform,
      account_id: `e2e-${platform}-${Date.now()}`,
      account_name: `E2E ${platform}`,
      access_token: encryptToken('fake-access-token'),
      refresh_token: refresh ? encryptToken('fake-refresh-token') : null,
      token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      status: 'active',
      is_connected: true,
      is_default: true,
    },
  })
  eq(res.status, 201, `insert account (${JSON.stringify(res.body)})`)
  return res.body[0].id
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
console.log(`ContentFlow E2E\n  app:      ${APP}\n  supabase: ${SB}\n  ai:       ${SKIP_AI ? 'skipped' : 'enabled'}`)

let A, B
let postId

section('Public pages and route protection')

await test('landing page renders', async () => {
  const res = await fetch(APP)
  eq(res.status, 200, 'status')
  const html = await res.text()
  assert(html.includes('ContentFlow'), 'brand missing')
  assert(!/7-day free trial|Join hundreds/i.test(html), 'unsubstantiated marketing claims still present')
})

for (const path of ['/login', '/signup', '/privacy', '/terms', '/robots.txt', '/sitemap.xml']) {
  await test(`${path} responds 200`, async () => {
    eq((await fetch(`${APP}${path}`)).status, 200, 'status')
  })
}

await test('legal pages carry no stale branding', async () => {
  for (const path of ['/privacy', '/terms']) {
    const html = await (await fetch(`${APP}${path}`)).text()
    assert(!/Intuity|Griffin@/i.test(html), `${path} still mentions Intuity`)
  }
})

await test('security headers are set', async () => {
  const res = await fetch(APP)
  eq(res.headers.get('x-frame-options'), 'DENY', 'x-frame-options')
  eq(res.headers.get('x-content-type-options'), 'nosniff', 'nosniff')
  assert(!res.headers.get('x-powered-by'), 'x-powered-by leaked')
})

for (const path of ['/dashboard', '/generate', '/posts', '/billing', '/onboarding', '/setPassword']) {
  await test(`${path} redirects anonymous users to /login`, async () => {
    const res = await app(null, path, { redirect: 'manual' })
    assert([302, 307].includes(res.status), `status ${res.status}`)
    assert(res.headers.get('location')?.includes('/login?redirect='), `location ${res.headers.get('location')}`)
  })
}

await test('middleware bypass header (CVE-2025-29927) is ignored', async () => {
  const res = await fetch(`${APP}/dashboard`, {
    redirect: 'manual',
    headers: { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' },
  })
  assert([302, 307].includes(res.status), `protected page served with bypass header (status ${res.status})`)
})

await test('API rejects anonymous requests with 401', async () => {
  for (const path of ['/api/posts', '/api/credits', '/api/analytics', '/api/notifications']) {
    eq((await app(null, path)).status, 401, path)
  }
})

section('Sign-up and profile')

await test('sign up with emailed 6-digit code (user A)', async () => {
  A = await signUp('a')
  assert(/ContentFlow/.test(A.subject), `email subject "${A.subject}"`)
})

await test('sign up user B', async () => {
  B = await signUp('b')
})

await test('profile is created with name, free plan and 100 credits', async () => {
  const p = await getProfile(A.id)
  eq(p.full_name, 'E2E a', 'full_name')
  eq(p.user_type, 'Creator', 'user_type')
  eq(p.plan, 'free', 'plan')
  eq(p.credits, 100, 'credits')
})

await test('user can set a password and log in with it', async () => {
  const set = await sb('/auth/v1/user', { method: 'PUT', token: A.access_token, body: { password: 'E2e-Passw0rd!' } })
  eq(set.status, 200, 'set password')
  const login = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: A.email, password: 'E2e-Passw0rd!' },
  })
  eq(login.status, 200, 'password login')
})

await test('signed-in user is sent from /login to /dashboard', async () => {
  const res = await app(A, '/login', { redirect: 'manual' })
  assert([302, 307].includes(res.status), `status ${res.status}`)
  assert(res.headers.get('location')?.endsWith('/dashboard'), `location ${res.headers.get('location')}`)
})

await test('dashboard renders for signed-in user', async () => {
  const res = await app(A, '/dashboard')
  eq(res.status, 200, 'status')
})

await test('onboarding answers save (and can be re-saved)', async () => {
  for (let i = 0; i < 2; i++) {
    const up = await sb('/rest/v1/user_preference?on_conflict=user_id', {
      method: 'POST',
      token: A.access_token,
      headers: { prefer: 'resolution=merge-duplicates' },
      body: {
        user_id: A.id,
        platforms: ['LinkedIn', 'X-Twitter'],
        business_type: 'Agency',
        pain_points: ['time'],
        niche_title: `Coffee shops ${i}`,
        niche_description: 'Local cafes',
      },
    })
    assert(up.status === 201 || up.status === 200, `upsert ${i}: ${up.status} ${JSON.stringify(up.body)}`)
  }
  const done = await sb(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', token: A.access_token, body: { is_onboarded: true } })
  eq(done.status, 204, 'mark onboarded')
  const account = await app(A, '/api/dashboard/account')
  eq(account.body.data.niche, 'Coffee shops 1', 'niche')
  eq(account.body.data.isOnboarded, true, 'onboarded')
})

section('Database security (direct PostgREST access with a user JWT)')

await test('user cannot give themselves credits', async () => {
  const res = await sb(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', token: A.access_token, body: { credits: 999999 } })
  assert(res.status >= 400, `update allowed (status ${res.status})`)
  eq((await getProfile(A.id)).credits, 100, 'credits changed')
})

await test('user cannot upgrade their own plan or role', async () => {
  for (const body of [{ plan: 'enterprise' }, { role: 'admin' }]) {
    const res = await sb(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', token: A.access_token, body })
    assert(res.status >= 400, `${Object.keys(body)[0]} update allowed (status ${res.status})`)
  }
  eq((await getProfile(A.id)).plan, 'free', 'plan changed')
})

await test('user cannot forge credit transactions or usage', async () => {
  const tx = await sb('/rest/v1/credit_transactions', {
    method: 'POST',
    token: A.access_token,
    body: { user_id: A.id, amount: 5000, transaction_type: 'addition' },
  })
  assert(tx.status >= 400, `transaction insert allowed (${tx.status})`)
  const usage = await sb(`/rest/v1/usage?user_id=eq.${A.id}`, { method: 'PATCH', token: A.access_token, body: { image_credits_used: 0 } })
  assert(usage.status >= 400, `usage update allowed (${usage.status})`)
})

await test('user cannot call the billing function apply_plan', async () => {
  const res = await sb('/rest/v1/rpc/apply_plan', {
    method: 'POST',
    token: A.access_token,
    body: { p_user: A.id, p_plan: 'enterprise', p_reset_credits: true },
  })
  assert(res.status >= 400, `apply_plan callable (${res.status})`)
  eq((await getProfile(A.id)).plan, 'free', 'plan changed')
})

await test('spend_credits rejects negative amounts', async () => {
  const res = await sb('/rest/v1/rpc/spend_credits', {
    method: 'POST',
    token: A.access_token,
    body: { p_amount: -500, p_kind: 'text' },
  })
  assert(res.status >= 400, `negative spend allowed (${res.status})`)
  eq((await getProfile(A.id)).credits, 100, 'credits changed')
})

await test('user cannot read another user\'s profile', async () => {
  const res = await sb(`/rest/v1/profiles?id=eq.${B.id}&select=*`, { token: A.access_token })
  eq(res.body.length, 0, 'rows visible')
})

await test('seeded backdoor account admin@intuity.ai cannot log in', async () => {
  const res = await sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: 'admin@intuity.ai', password: 'Admin123!' },
  })
  assert(res.status >= 400, 'backdoor login succeeded')
})

section('Credits API')

await test('GET /api/credits returns balance and plan', async () => {
  const res = await app(A, '/api/credits')
  eq(res.status, 200, 'status')
  eq(res.body.data.credits, 100, 'credits')
  eq(res.body.data.plan, 'free', 'plan')
  eq(res.body.data.monthly_allowance, 100, 'allowance')
})

await test('POST /api/credits (old self-service "add") no longer exists', async () => {
  const res = await app(A, '/api/credits', { method: 'POST', body: { action: 'add', amount: 10000 } })
  eq(res.status, 405, 'status')
  eq((await getProfile(A.id)).credits, 100, 'credits changed')
})

section('AI generation')

if (!SKIP_AI) {
  await test('generate content for LinkedIn and X (charges 10 credits)', async () => {
    const res = await app(A, '/api/ai/generate', {
      method: 'POST',
      timeout: 120_000,
      body: {
        platform: ['LinkedIn', 'X-Twitter'],
        prompt: 'Announce our new oat-milk cold brew, launching this Friday at all three locations',
        tone: 'Enthusiastic',
        audience: 'Local coffee lovers',
      },
    })
    eq(res.status, 200, `status (${JSON.stringify(res.body).slice(0, 300)})`)
    const d = res.body.data
    assert(d.name, 'no campaign name')
    assert(d.platform_posts.LinkedIn?.post, 'no LinkedIn post')
    assert(d.platform_posts['X-Twitter']?.post, 'no X post')
    assert(Array.isArray(d.platform_posts.LinkedIn.hashtags), 'hashtags not an array')
    eq((await getProfile(A.id)).credits, 90, 'credits after generation')
  })

  await test('generate an image, stored in the user\'s media folder (charges 25)', async () => {
    const before = (await getProfile(A.id)).credits
    const res = await app(A, '/api/ai/image', {
      method: 'POST',
      timeout: 180_000,
      body: { prompt: 'Iced oat-milk cold brew on a sunny cafe counter' },
    })
    eq(res.status, 200, `status (${JSON.stringify(res.body).slice(0, 300)})`)
    const url = res.body.data.image_url
    assert(url.startsWith(SB) && url.includes(`/media/${A.id}/generated/`), `unexpected url ${url}`)
    const img = await fetch(url)
    eq(img.status, 200, 'stored image not reachable')
    assert(img.headers.get('content-type')?.startsWith('image/'), 'not an image')
    eq((await getProfile(A.id)).credits, before - 25, 'credits after image')
  })
} else {
  console.log('  - skipped (SKIP_AI=1)')
}

await test('generation input is validated', async () => {
  const bad = [
    { platform: ['MySpace'], prompt: 'valid prompt here', tone: 'Casual' },
    { platform: ['LinkedIn'], prompt: 'hey', tone: 'Casual' },
    { platform: ['LinkedIn'], prompt: 'valid prompt here', tone: 'Angry' },
  ]
  for (const body of bad) {
    eq((await app(A, '/api/ai/generate', { method: 'POST', body })).status, 400, JSON.stringify(body))
  }
})

await test('out-of-credit users get 402 and are not charged', async () => {
  await admin(`/rest/v1/profiles?id=eq.${B.id}`, { method: 'PATCH', body: { credits: 5 } })
  const res = await app(B, '/api/ai/generate', {
    method: 'POST',
    body: { platform: ['LinkedIn'], prompt: 'This should be refused', tone: 'Casual' },
  })
  eq(res.status, 402, 'status')
  eq(res.body.error, 'Insufficient credits', 'error')
  eq((await getProfile(B.id)).credits, 5, 'credits changed')
})

await test('concurrent spends never overdraw the balance', async () => {
  await admin(`/rest/v1/profiles?id=eq.${B.id}`, { method: 'PATCH', body: { credits: 30 } })
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      sb('/rest/v1/rpc/spend_credits', { method: 'POST', token: B.access_token, body: { p_amount: 10, p_kind: 'text' } })
    )
  )
  eq(results.filter((r) => r.status === 200).length, 3, 'successful spends')
  eq((await getProfile(B.id)).credits, 0, 'final balance')
})

section('Posts')

const variants = {
  LinkedIn: { post: 'Our oat-milk cold brew lands Friday.', call_to_action: 'Visit us', hashtags: ['coldbrew', 'oatmilk'] },
  'X-Twitter': { post: 'Oat-milk cold brew. Friday. ☕', hashtags: ['coldbrew'] },
}

await test('scheduling in the past is rejected', async () => {
  const res = await app(A, '/api/posts', {
    method: 'POST',
    body: { title: 'Past', platforms: ['LinkedIn'], platform_variants: variants, scheduled_for: '2020-01-01T00:00:00Z' },
  })
  eq(res.status, 400, 'status')
})

await test('create a scheduled multi-platform post', async () => {
  const when = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const res = await app(A, '/api/posts', {
    method: 'POST',
    body: {
      title: 'Cold brew launch',
      description: 'Launch week',
      platforms: ['LinkedIn', 'X-Twitter'],
      platform_variants: variants,
      tone: 'Enthusiastic',
      generated_by_ai: true,
      scheduled_for: when,
    },
  })
  eq(res.status, 201, `status (${JSON.stringify(res.body)})`)
  postId = res.body.data.id
  eq(res.body.data.status, 'scheduled', 'status')
  eq(res.body.data.content, variants.LinkedIn.post, 'content defaults to first platform')
  eq(Object.keys(res.body.data.platform_variants).length, 2, 'both platform versions kept')
})

await test('list and search posts', async () => {
  const all = await app(A, '/api/posts')
  assert(all.body.data.some((p) => p.id === postId), 'post missing from list')
  const hit = await app(A, '/api/posts?q=cold%20brew')
  assert(hit.body.data.some((p) => p.id === postId), 'search missed')
  const miss = await app(A, '/api/posts?q=zzz-nothing')
  eq(miss.body.data.length, 0, 'search false positive')
  const injected = await app(A, `/api/posts?q=${encodeURIComponent('a%,id.neq.0),(title')}`)
  eq(injected.status, 200, 'filter injection not handled')
})

await test('update post copy, then unschedule it', async () => {
  const edited = { ...variants, LinkedIn: { ...variants.LinkedIn, post: 'Edited LinkedIn copy' } }
  const res = await app(A, `/api/posts/${postId}`, { method: 'PATCH', body: { platform_variants: edited } })
  eq(res.status, 200, 'patch')
  eq(res.body.data.platform_variants.LinkedIn.post, 'Edited LinkedIn copy', 'edit saved')
  const un = await app(A, `/api/posts/${postId}`, { method: 'PATCH', body: { scheduled_for: null } })
  eq(un.body.data.status, 'draft', 'status after unschedule')
})

await test('post update ignores protected fields', async () => {
  const res = await app(A, `/api/posts/${postId}`, { method: 'PATCH', body: { user_id: B.id, title: 'Still mine' } })
  eq(res.status, 200, 'status')
  const { body } = await admin(`/rest/v1/content_posts?id=eq.${postId}&select=user_id,title`)
  eq(body[0].user_id, A.id, 'owner changed')
})

await test('mark published on LinkedIn with live URL', async () => {
  const res = await app(A, `/api/posts/${postId}/publish`, {
    method: 'POST',
    body: { platforms: [{ platform: 'LinkedIn', url: 'https://www.linkedin.com/feed/update/123' }] },
  })
  eq(res.status, 200, `status (${JSON.stringify(res.body)})`)
  // LinkedIn is live but X isn't yet
  eq(res.body.data.status, 'partially_published', 'post status')
  eq(res.body.data.targets[0].external_url, 'https://www.linkedin.com/feed/update/123', 'url')
  const bad = await app(A, `/api/posts/${postId}/publish`, {
    method: 'POST',
    body: { platforms: [{ platform: 'LinkedIn', url: 'javascript:alert(1)' }] },
  })
  eq(bad.status, 400, 'javascript: URL accepted')
})

await test('record results and see them in analytics and dashboard', async () => {
  const rec = await app(A, `/api/posts/${postId}/metrics`, {
    method: 'POST',
    body: { platform: 'LinkedIn', metrics: { impressions: 1000, likes: 40, comments: 5, shares: 3, clicks: 2 } },
  })
  eq(rec.status, 200, `record (${JSON.stringify(rec.body)})`)
  // Re-recording replaces values rather than double counting
  await app(A, `/api/posts/${postId}/metrics`, { method: 'POST', body: { platform: 'LinkedIn', metrics: { likes: 50 } } })

  const a = await app(A, '/api/analytics')
  eq(a.status, 200, 'analytics')
  eq(a.body.data.totals.impressions, 1000, 'impressions')
  eq(a.body.data.totals.likes, 50, 'likes')
  eq(a.body.data.engagement_rate, 6, 'engagement rate')
  eq(a.body.data.top_posts[0].id, postId, 'top post')

  const stats = await app(A, '/api/dashboard/stats')
  eq(stats.body.data.publishedPosts, 1, 'published count')
  eq(stats.body.data.weeklyData.length, 7, 'weekly data')

  const bad = await app(A, `/api/posts/${postId}/metrics`, { method: 'POST', body: { platform: 'LinkedIn', metrics: { likes: -3 } } })
  eq(bad.status, 400, 'negative metric accepted')
})

await test('dashboard widgets load', async () => {
  for (const path of ['/api/dashboard/performance', '/api/dashboard/credits', '/api/dashboard/account']) {
    const res = await app(A, path)
    eq(res.status, 200, `${path} ${JSON.stringify(res.body).slice(0, 200)}`)
  }
})

await test('another user cannot read, edit or delete the post', async () => {
  eq((await app(B, `/api/posts/${postId}`)).status, 404, 'read')
  eq((await app(B, `/api/posts/${postId}`, { method: 'PATCH', body: { title: 'pwned' } })).status, 404, 'edit')
  eq((await app(B, `/api/posts/${postId}`, { method: 'DELETE' })).status, 404, 'delete')
  eq((await app(B, `/api/posts/${postId}/metrics`, { method: 'POST', body: { platform: 'LinkedIn', metrics: { likes: 1 } } })).status, 404, 'metrics')
  const direct = await sb(`/rest/v1/content_posts?id=eq.${postId}&select=id`, { token: B.access_token })
  eq(direct.body.length, 0, 'visible via PostgREST')
})

section('Auto-publishing')

await test('cron endpoints reject missing or wrong secrets', async () => {
  for (const path of ['/api/cron/publish', '/api/cron/sync-analytics']) {
    const none = await cron(path, null)
    assert([401, 403].includes(none.status), `${path} without secret: ${none.status}`)
    const wrong = await cron(path, 'not-the-secret')
    assert([401, 403].includes(wrong.status), `${path} wrong secret: ${wrong.status}`)
  }
})

await test('health: public ok, details only with the cron secret', async () => {
  const pub = await fetch(`${APP}/api/health`)
  const body = await pub.json()
  eq(pub.status, 200, 'status')
  eq(body.ok, true, 'ok')
  assert(!('ai' in body), 'details leaked without secret')
  const priv = await fetch(`${APP}/api/health`, { headers: { authorization: `Bearer ${CRON_SECRET}` } })
  const detail = await priv.json()
  eq(detail.email.provider, 'smtp', 'email provider')
  eq(detail.publishing.encryptionKey, true, 'encryption key')
})

await test('connected-accounts API lists platforms; tokens are not readable by users', async () => {
  const res = await app(A, '/api/social-accounts')
  eq(res.status, 200, 'status')
  eq(res.body.data.platforms.length, 6, 'platform count')
  const direct = await sb('/rest/v1/social_accounts?select=access_token', { token: A.access_token })
  assert(direct.status >= 400 || direct.body.length === 0, 'tokens readable by the user')
})

await test('users cannot write publish targets directly', async () => {
  const res = await sb('/rest/v1/post_targets', {
    method: 'POST',
    token: A.access_token,
    body: { post_id: postId, platform: 'X-Twitter', status: 'published', external_id: '123' },
  })
  assert(res.status >= 400, `insert allowed (${res.status})`)
})

await test('posts reject media that is not the user own upload', async () => {
  const urls = [
    'http://169.254.169.254/latest/meta-data/',
    'https://example.com/a.png',
    `${SB}/storage/v1/object/public/media/${B.id}/uploads/x.png`,
  ]
  for (const url of urls) {
    const res = await app(A, '/api/posts', { method: 'POST', body: { content: 'x', media_urls: [url] } })
    eq(res.status, 400, url)
  }
})

let manualPostId
await test('cron publishes due posts: no account -> needs manual + notification + SMTP email', async () => {
  manualPostId = await duePost(A, ['LinkedIn', 'X-Twitter'])
  const sentAt = Date.now()
  const run = await cron('/api/cron/publish')
  eq(run.status, 200, `cron (${JSON.stringify(run.body)})`)
  const post = await app(A, `/api/posts/${manualPostId}`)
  eq(post.body.data.status, 'failed', 'post status')
  const targets = Object.fromEntries(post.body.data.targets.map((t) => [t.platform, t.status]))
  eq(targets.LinkedIn, 'needs_manual', 'LinkedIn target')
  eq(targets['X-Twitter'], 'needs_manual', 'X target')
  const notes = await app(A, '/api/notifications')
  assert(
    notes.body.data.notifications.some((n) => n.type === 'needs_manual' && n.link === `/posts/${manualPostId}`),
    'no notification'
  )
  assert(notes.body.data.unread > 0, 'unread count')
  const mail = await findEmail(A.email, sentAt, /published manually/)
  assert(mail, 'no email delivered over SMTP')
})

await test('a post that needs manual posting can still be marked published', async () => {
  const res = await app(A, `/api/posts/${manualPostId}/publish`, {
    method: 'POST',
    body: { platforms: [{ platform: 'LinkedIn' }] },
  })
  eq(res.status, 200, 'mark published')
  eq(res.body.data.status, 'partially_published', 'post status')
})

await test('notifications can be marked read', async () => {
  const res = await app(A, '/api/notifications', { method: 'POST', body: { all: true } })
  eq(res.status, 200, 'status')
  eq(res.body.data.unread, 0, 'unread after mark all')
})

if (TOKEN_KEY) {
  await test('expired connection -> account marked expired, reconnect notification', async () => {
    const accountId = await insertAccount(A, 'X-Twitter', { expiresInSec: -3600 })
    const id = await duePost(A, ['X-Twitter'])
    const run = await cron('/api/cron/publish')
    eq(run.status, 200, 'cron')
    const post = await app(A, `/api/posts/${id}`)
    eq(post.body.data.targets[0].status, 'failed', 'target')
    const { body } = await admin(`/rest/v1/social_accounts?id=eq.${accountId}&select=status`)
    eq(body[0].status, 'expired', 'account status')
    const notes = await app(A, '/api/notifications')
    assert(notes.body.data.notifications.some((n) => n.type === 'account_expired'), 'no reconnect notification')
    await admin(`/rest/v1/social_accounts?id=eq.${accountId}`, { method: 'DELETE' })
  })

  await test('publisher refuses non-storage media before contacting the platform (SSRF)', async () => {
    const accountId = await insertAccount(A, 'LinkedIn', { expiresInSec: 7 * 24 * 3600 })
    const id = await duePost(A, ['LinkedIn'], { media_urls: ['http://169.254.169.254/latest/meta-data/'] })
    const res = await app(A, `/api/posts/${id}/publish`, { method: 'POST', body: { mode: 'auto' } })
    eq(res.status, 200, `publish now (${JSON.stringify(res.body).slice(0, 200)})`)
    const target = res.body.data.targets.find((t) => t.platform === 'LinkedIn')
    eq(target.status, 'failed', 'target status')
    assert(/uploaded to ContentFlow/.test(target.error_message || ''), `error: ${target.error_message}`)
    const { body } = await admin(`/rest/v1/social_accounts?id=eq.${accountId}&select=status`)
    eq(body[0].status, 'active', 'account untouched (platform never called)')
    await admin(`/rest/v1/social_accounts?id=eq.${accountId}`, { method: 'DELETE' })
  })
} else {
  console.log('  - token tests skipped (TOKEN_ENCRYPTION_KEY not set)')
}

await test('overdue scheduled posts the publisher missed show as an alert', async () => {
  const created = await app(A, '/api/posts', {
    method: 'POST',
    body: { content: 'Overdue', scheduled_for: new Date(Date.now() + 3600_000).toISOString() },
  })
  const id = created.body.data.id
  await admin(`/rest/v1/content_posts?id=eq.${id}`, {
    method: 'PATCH',
    body: { scheduled_for: new Date(Date.now() - 30 * 60_000).toISOString() },
  })
  const notes = await app(A, '/api/notifications')
  assert(notes.body.data.alerts.some((a) => a.link === `/posts/${id}`), 'no overdue alert')
  await app(A, `/api/posts/${id}`, { method: 'DELETE' })
})

section('Calendar, feedback, media')

await test('calendar events: create, list, update, delete', async () => {
  const when = new Date(Date.now() + 2 * 86400000).toISOString()
  const created = await app(A, '/api/calendar', {
    method: 'POST',
    body: { title: 'Launch planning', eventDate: when, eventType: 'reminder' },
  })
  eq(created.status, 201, 'create')
  const id = created.body.data.id
  const start = new Date(Date.now() - 86400000).toISOString()
  const end = new Date(Date.now() + 7 * 86400000).toISOString()
  const list = await app(A, `/api/calendar?type=range&startDate=${start}&endDate=${end}`)
  assert(list.body.data.some((e) => e.id === id), 'event missing')
  const upd = await app(A, '/api/calendar', { method: 'PUT', body: { eventId: id, title: 'Launch planning v2', user_id: B.id } })
  eq(upd.body.data.title, 'Launch planning v2', 'update')
  eq(upd.body.data.user_id, A.id, 'owner changed')
  eq((await app(B, `/api/calendar?id=${id}`, { method: 'DELETE' })).status, 404, 'other user deleted')
  eq((await app(A, `/api/calendar?id=${id}`, { method: 'DELETE' })).status, 200, 'delete')
  eq((await app(A, '/api/calendar', { method: 'POST', body: { title: '', eventDate: when } })).status, 400, 'empty title')
})

await test('feedback is saved', async () => {
  const res = await app(A, '/api/feedback', { method: 'POST', body: { rating: 4, feedback: 'Nice', source: 'post_feedback' } })
  eq(res.status, 201, 'status')
})

await test('users can upload only into their own media folder', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
  const own = await sb(`/storage/v1/object/media/${A.id}/uploads/e2e.png`, {
    method: 'POST',
    token: A.access_token,
    headers: { 'content-type': 'image/png' },
    raw: png,
  })
  eq(own.status, 200, `own upload (${JSON.stringify(own.body)})`)
  const other = await sb(`/storage/v1/object/media/${B.id}/uploads/evil.png`, {
    method: 'POST',
    token: A.access_token,
    headers: { 'content-type': 'image/png' },
    raw: png,
  })
  assert(other.status >= 400, `cross-folder upload allowed (${other.status})`)
  const html = await sb(`/storage/v1/object/media/${A.id}/uploads/x.html`, {
    method: 'POST',
    token: A.access_token,
    headers: { 'content-type': 'text/html' },
    raw: '<script>alert(1)</script>',
  })
  assert(html.status >= 400, `HTML upload allowed (${html.status})`)
})

section('Plans and billing')

await test('plans endpoint lists all plans (billing not configured locally)', async () => {
  const res = await app(null, '/api/billing/plans')
  eq(res.status, 200, 'status')
  eq(res.body.data.plans.length, 5, 'plan count')
  eq(res.body.data.plans[0].monthlyCredits, 100, 'free allowance')
})

await test('checkout fails cleanly without Stripe keys', async () => {
  const res = await app(A, '/api/billing/checkout', { method: 'POST', body: { plan: 'creator' } })
  assert(res.status >= 400 && res.status < 600 && res.body.success === false, `status ${res.status}`)
})

await test('webhook rejects unsigned requests', async () => {
  const res = await fetch(`${APP}/api/billing/webhook`, { method: 'POST', body: '{}' })
  assert(res.status === 400 || res.status === 500, `status ${res.status}`)
})

await test('Stripe webhook processes each event exactly once', async () => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.log('      (skipped: STRIPE_WEBHOOK_SECRET not set)')
    return
  }
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe('sk_test_dummy')
  const payload = JSON.stringify({
    id: `evt_e2e_${Date.now()}`,
    object: 'event',
    type: 'customer.created',
    data: { object: {} },
  })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET })
  const send = () =>
    fetch(`${APP}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      body: payload,
    }).then((r) => r.json())
  const first = await send()
  eq(first.received, true, 'first delivery')
  assert(!first.duplicate, 'first delivery marked duplicate')
  const second = await send()
  eq(second.duplicate, true, 'redelivery not detected')
})

await test('plan upgrade (as applied by the Stripe webhook) grants the plan allowance', async () => {
  const res = await admin('/rest/v1/rpc/apply_plan', {
    method: 'POST',
    body: { p_user: B.id, p_plan: 'creator', p_reset_credits: false, p_description: 'E2E upgrade' },
  })
  eq(res.status, 204, `apply_plan (${JSON.stringify(res.body)})`)
  const p = await getProfile(B.id)
  eq(p.plan, 'creator', 'plan')
  eq(p.credits, 600, 'credits')
  const balance = await app(B, '/api/credits')
  eq(balance.body.data.plan_name, 'Creator Pro', 'plan name')
})

await test('free plan tops up to 100 credits once a month', async () => {
  const twoMonthsAgo = new Date(Date.now() - 62 * 86400000).toISOString()
  await admin(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', body: { credits: 3, credits_refreshed_at: twoMonthsAgo } })
  const first = await app(A, '/api/credits')
  eq(first.body.data.credits, 100, 'after refresh')
  await admin(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', body: { credits: 3 } })
  const second = await app(A, '/api/credits')
  eq(second.body.data.credits, 3, 'refreshed twice in one month')
  const tx = await app(A, '/api/credits?type=transactions')
  assert(tx.body.data.some((t) => t.description === 'Monthly free credits'), 'refill not logged')
})

section('Account deletion')

await test('deleting an account removes the user and all their data', async () => {
  const before = await admin(`/rest/v1/content_posts?user_id=eq.${A.id}&select=id`)
  assert(before.body.length > 0, 'expected posts before delete')

  const unconfirmed = await app(A, '/api/account', { method: 'DELETE', body: {} })
  eq(unconfirmed.status, 400, 'deletion without confirmation')
  const res = await app(A, '/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } })
  eq(res.status, 200, `status (${JSON.stringify(res.body)})`)

  const user = await admin(`/auth/v1/admin/users/${A.id}`)
  eq(user.status, 404, 'auth user still exists')
  eq((await admin(`/rest/v1/content_posts?user_id=eq.${A.id}&select=id`)).body.length, 0, 'posts remain')
  eq((await admin(`/rest/v1/profiles?id=eq.${A.id}&select=id`)).body.length, 0, 'profile remains')
  const files = await admin(`/storage/v1/object/list/media`, { method: 'POST', body: { prefix: `${A.id}/uploads`, limit: 10 } })
  eq(files.body.length, 0, 'media remains')
})

// Clean up user B
if (B) await admin(`/auth/v1/admin/users/${B.id}`, { method: 'DELETE' })

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`  - ${f.name}: ${f.err?.message || f.err}`)
  process.exit(1)
}
