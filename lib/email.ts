/**
 * Transactional email through the Resend REST API. Server-only.
 *
 * Requires RESEND_API_KEY; the sender is EMAIL_FROM (an address on a domain
 * verified in Resend). Without RESEND_API_KEY, emails are skipped.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'ContentFlow <onboarding@resend.dev>'

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
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

/**
 * Send one email. Returns true when Resend accepted it. Never throws.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject.slice(0, 200),
        html: message.html,
        text: message.text,
      }),
    })

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      console.error(`Resend email failed (${res.status}): ${detail}`)
      return false
    }
    return true
  } catch (error) {
    console.error('Resend email failed:', error instanceof Error ? error.message : error)
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
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">${escapeHtml(linkLabel)}</a></p>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;border:1px solid #e5e7eb;">
      <h1 style="font-size:18px;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
      ${button}
      <p style="margin:28px 0 0;font-size:12px;color:#6b7280;">You are receiving this because you use ContentFlow to publish to your social accounts.</p>
    </div>
  </body>
</html>`

  const text = [input.title, input.body || '', url ? `${linkLabel}: ${url}` : '']
    .filter(Boolean)
    .join('\n\n')

  return { html, text }
}
