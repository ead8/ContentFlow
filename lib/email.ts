/**
 * Transactional email. Server-only.
 *
 * Providers (EMAIL_PROVIDER, or picked automatically):
 *   - resend: Resend HTTP API            (RESEND_API_KEY)
 *   - smtp:   any SMTP server            (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE)
 *             e.g. Resend SMTP, Amazon SES, Postmark, Mailgun, SendGrid, Google Workspace
 *   - log:    print instead of sending   (development default)
 *   - none:   disable email
 *
 * The sender is EMAIL_FROM, an address on a domain verified with the provider.
 * sendEmail() never throws; failures are logged and reported as `false`.
 */
import type { Transporter } from 'nodemailer'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'ContentFlow <onboarding@resend.dev>'

export type EmailProvider = 'resend' | 'smtp' | 'log' | 'none'

export function emailProvider(): EmailProvider {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  if (explicit === 'resend' || explicit === 'smtp' || explicit === 'log' || explicit === 'none') return explicit
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SMTP_HOST) return 'smtp'
  return process.env.NODE_ENV === 'production' ? 'none' : 'log'
}

/** True when emails are actually delivered (not just logged) */
export function isEmailConfigured(): boolean {
  const p = emailProvider()
  if (p === 'resend') return Boolean(process.env.RESEND_API_KEY)
  if (p === 'smtp') return Boolean(process.env.SMTP_HOST)
  return false
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Absolute URL for an in-app path, when NEXT_PUBLIC_APP_URL is set */
export function absoluteAppUrl(path?: string | null): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/+$/, '')
  if (!base || !/^https?:\/\//.test(base)) return null
  if (!path) return base
  if (/^https?:\/\//.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

/** Strip characters that could break out of a header line */
function headerSafe(value: string, max = 200): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, max)
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/

let smtpTransport: Transporter | null = null

async function getSmtpTransport(): Promise<Transporter> {
  if (smtpTransport) return smtpTransport
  const nodemailer = await import('nodemailer')
  const port = Number(process.env.SMTP_PORT || 587)
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Implicit TLS on 465; STARTTLS (upgraded automatically) otherwise
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return smtpTransport
}

async function sendViaResend(from: string, message: EmailMessage, subject: string): Promise<boolean> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ from, to: [message.to], subject, html: message.html, text: message.text }),
  })

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    console.error(`Resend email failed (${res.status}): ${detail}`)
    return false
  }
  return true
}

async function sendViaSmtp(from: string, message: EmailMessage, subject: string): Promise<boolean> {
  const transport = await getSmtpTransport()
  await transport.sendMail({ from, to: message.to, subject, html: message.html, text: message.text })
  return true
}

/**
 * Send one email. Returns true when the provider accepted it. Never throws.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = emailProvider()
  if (provider === 'none') return false

  if (!EMAIL_RE.test(message.to)) {
    console.error('Email not sent: invalid recipient address')
    return false
  }

  const from = headerSafe(process.env.EMAIL_FROM || DEFAULT_FROM)
  const subject = headerSafe(message.subject)

  if (provider === 'log') {
    console.info(`[email:log] to=${message.to} subject="${subject}"\n${message.text || ''}`)
    return false
  }

  try {
    if (provider === 'resend') {
      if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
      return await sendViaResend(from, message, subject)
    }
    if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST is not set')
    return await sendViaSmtp(from, message, subject)
  } catch (error) {
    console.error(`Email via ${provider} failed:`, error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * A simple, safe notification email. All values are escaped; `link` is an
 * in-app path or absolute URL and is only rendered as a button when an
 * absolute URL can be built.
 */
export function renderNotificationEmail(input: {
  title: string
  body?: string | null
  link?: string | null
  linkLabel?: string
}): { html: string; text: string } {
  const url = absoluteAppUrl(input.link ?? null)
  const linkLabel = input.linkLabel || 'Open ContentFlow'
  const title = escapeHtml(input.title)
  const bodyHtml = input.body
    ? escapeHtml(input.body)
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
    : ''
  const button = url
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">${escapeHtml(linkLabel)}</a></p>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;border:1px solid #e5e7eb;">
      <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
      ${button}
      <p style="margin:28px 0 0;font-size:12px;color:#6b7280;">You are receiving this because you use ContentFlow to publish to your social accounts. Manage email preferences in Settings.</p>
    </div>
  </body>
</html>`

  const text = [input.title, input.body || '', url ? `${linkLabel}: ${url}` : '']
    .filter(Boolean)
    .join('\n\n')

  return { html, text }
}
