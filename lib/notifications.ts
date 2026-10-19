import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailConfigured, renderNotificationEmail, sendEmail } from '@/lib/email'

/**
 * In-app notifications (and optional email) for background events such as
 * publish failures. Server-only: writes with the service role.
 */

export type NotificationType =
  | 'publish_failed'
  | 'publish_succeeded'
  | 'account_expired'
  | 'needs_manual'

export interface NotificationInput {
  type: NotificationType
  title: string
  body?: string
  /** In-app path, e.g. /posts/{id} */
  link?: string
  /** Also email the user (only when RESEND_API_KEY is set) */
  email?: boolean
}

const LINK_LABELS: Record<NotificationType, string> = {
  publish_failed: 'View post',
  publish_succeeded: 'View post',
  account_expired: 'Reconnect account',
  needs_manual: 'View post',
}

/**
 * Create a notification for the user. Never throws (logs instead).
 */
export async function notify(userId: string, n: NotificationInput): Promise<void> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('notify: admin client unavailable:', error instanceof Error ? error.message : error)
    return
  }

  try {
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      type: n.type,
      title: n.title.slice(0, 300),
      body: n.body ? n.body.slice(0, 2000) : null,
      link: n.link ?? null,
    })
    if (error) console.error('notify: insert failed:', error.message)
  } catch (error) {
    console.error('notify: insert failed:', error instanceof Error ? error.message : error)
  }

  if (!n.email || !isEmailConfigured()) return

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) {
      if (error) console.error('notify: could not load user email:', error.message)
      return
    }
    const { html, text } = renderNotificationEmail({
      title: n.title,
      body: n.body,
      link: n.link,
      linkLabel: LINK_LABELS[n.type],
    })
    await sendEmail({ to: data.user.email, subject: n.title, html, text })
  } catch (error) {
    console.error('notify: email failed:', error instanceof Error ? error.message : error)
  }
}
