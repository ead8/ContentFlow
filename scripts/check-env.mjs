#!/usr/bin/env node
/**
 * Validate environment configuration before deploying.
 *
 *   npm run check:env                 # reads .env.local, then process env
 *   NODE_ENV=production npm run check:env
 *
 * Exits 1 when something required is missing or invalid. Never prints secrets.
 */
import { existsSync, readFileSync } from 'node:fs'

const env = { ...process.env }
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
}

const production = env.NODE_ENV === 'production'
const errors = []
const warnings = []
const ok = []
const has = (k) => Boolean(env[k] && env[k].trim())
const isUrl = (v) => {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// App + Supabase
for (const k of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
  if (!has(k)) errors.push(`${k} is required`)
  else if (!isUrl(env[k])) errors.push(`${k} must be a URL`)
  else if (production && !env[k].startsWith('https://')) errors.push(`${k} must use https in production`)
}
if (!has('NEXT_PUBLIC_SUPABASE_ANON_KEY')) errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
if (!has('SUPABASE_SERVICE_ROLE_KEY')) errors.push('SUPABASE_SERVICE_ROLE_KEY is required (publisher, billing, account deletion)')
if (production && !has('NEXT_PUBLIC_SUPPORT_EMAIL')) warnings.push('NEXT_PUBLIC_SUPPORT_EMAIL is empty (shown on legal pages)')

// Security
if (!has('TOKEN_ENCRYPTION_KEY')) {
  errors.push('TOKEN_ENCRYPTION_KEY is required for social publishing')
} else {
  const len = Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64').length
  if (len !== 32) errors.push(`TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 (got ${len} bytes)`)
}
if (!has('CRON_SECRET')) errors.push('CRON_SECRET is required for scheduled publishing')
else if (env.CRON_SECRET.length < 32) warnings.push('CRON_SECRET is short; use 32+ random characters')

// AI
const aiProvider = (env.AI_PROVIDER || '').toLowerCase() ||
  ((env.OPENAI_BASE_URL || '').includes('pollinations.ai') ? 'pollinations' : env.OPENAI_BASE_URL ? 'custom' : 'openai')
if (aiProvider === 'pollinations') {
  ;(production ? warnings : ok).push('AI: pollinations is a rate-limited demo provider; set AI_PROVIDER=openai and OPENAI_API_KEY for production')
} else if (!has('OPENAI_API_KEY')) {
  errors.push(`AI: OPENAI_API_KEY is required for AI_PROVIDER=${aiProvider}`)
} else ok.push(`AI: ${aiProvider}`)
if (aiProvider === 'custom' && !has('OPENAI_BASE_URL')) errors.push('AI: OPENAI_BASE_URL is required for AI_PROVIDER=custom')

// Email
const emailProvider = (env.EMAIL_PROVIDER || '').toLowerCase() ||
  (has('RESEND_API_KEY') ? 'resend' : has('SMTP_HOST') ? 'smtp' : production ? 'none' : 'log')
if (emailProvider === 'resend' && !has('RESEND_API_KEY')) errors.push('Email: RESEND_API_KEY is required for EMAIL_PROVIDER=resend')
if (emailProvider === 'smtp' && !has('SMTP_HOST')) errors.push('Email: SMTP_HOST is required for EMAIL_PROVIDER=smtp')
if (['resend', 'smtp'].includes(emailProvider)) {
  if (!has('EMAIL_FROM')) warnings.push('Email: EMAIL_FROM is empty (falls back to onboarding@resend.dev)')
  ok.push(`Email: ${emailProvider}`)
} else if (production) {
  warnings.push('Email: no provider configured; publish-failure emails are disabled')
}

// Stripe
const prices = ['STRIPE_PRICE_CREATOR', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_AGENCY', 'STRIPE_PRICE_ENTERPRISE']
if (has('STRIPE_SECRET_KEY')) {
  if (!has('STRIPE_WEBHOOK_SECRET')) errors.push('Stripe: STRIPE_WEBHOOK_SECRET is required with STRIPE_SECRET_KEY')
  if (!prices.some(has)) warnings.push('Stripe: no STRIPE_PRICE_* set; no plan can be bought')
  if (production && env.STRIPE_SECRET_KEY.startsWith('sk_test_')) warnings.push('Stripe: test key in production')
  ok.push('Stripe: configured')
} else {
  warnings.push('Stripe: not configured; paid plans cannot be bought')
}

// Social platforms
const platforms = {
  LinkedIn: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  'Facebook/Instagram': ['META_APP_ID', 'META_APP_SECRET'],
  X: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
  TikTok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  YouTube: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
}
const configured = []
for (const [name, keys] of Object.entries(platforms)) {
  const set = keys.filter(has)
  if (set.length === keys.length) configured.push(name)
  else if (set.length > 0) errors.push(`${name}: set both ${keys.join(' and ')}`)
}
if (configured.length) ok.push(`Social: ${configured.join(', ')}`)
else warnings.push('Social: no platform apps configured; posts can only be published manually')

for (const m of ok) console.log(`  ok    ${m}`)
for (const m of warnings) console.log(`  warn  ${m}`)
for (const m of errors) console.log(`  ERROR ${m}`)
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)${production ? ' [production]' : ''}`)
process.exit(errors.length ? 1 : 0)
