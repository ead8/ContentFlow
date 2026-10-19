# Launch checklist

Short go-to-market list. Lead times are typical, not guaranteed; start the
platform reviews first because they gate real users.

## 1. Platform approvals (start now)

Each review needs a live production URL, privacy policy, terms of service and
usually a screencast of: connect account → compose → publish → see the post.

| Platform | What to get | Typical lead time | Until approved |
|---|---|---|---|
| LinkedIn | "Share on LinkedIn" + "Sign In with OpenID Connect" (self-serve). Company Pages: Community Management API, Development then Standard tier | Self-serve: instant. CM API: days to several weeks per tier | Personal profiles only; no company pages |
| Meta (Facebook + Instagram) | Business Verification, then App Review for Advanced Access to `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights` (+ `business_management` if used) | Verification: days to 2 weeks. App Review: about 1–4 weeks, often with a resubmission | Only people with a role on the app can connect |
| X | Paid API access (pay-per-use credits + spending limit) | Same day | Publishing fails (402) |
| TikTok | App review (leave sandbox), then Content Posting API audit (Direct Post) | App review: days. Audit: about 2–6 weeks | Posts are forced private (`SELF_ONLY`) |
| YouTube | Google OAuth verification (sensitive scope `youtube.upload`, verified domain, demo video) and YouTube API Services audit (quota + public uploads) | OAuth verification: days to weeks. Audit: about 2–4 weeks | 100 test users, 7-day refresh tokens, uploads locked private |

- [ ] Register production redirect URIs: `https://<domain>/api/social/{linkedin,facebook,instagram,x,tiktok,youtube}/callback`
- [ ] Meta: data deletion — in App settings → Basic → Data deletion requests,
      set the **Data deletion callback URL** to
      `https://<domain>/api/social/meta/data-deletion` (built: verifies the
      `signed_request` with `META_APP_SECRET`, deletes that Facebook user's
      Facebook / Instagram `social_accounts` rows and returns
      `{ url: "https://<domain>/data-deletion?code=...", confirmation_code }`).
      Test it once with Meta's "Send test request" / a real app removal and
      open the returned status URL. Accounts connected before
      `metadata.fbUserId` was stored must reconnect once to be matchable.
      (A Deauthorize callback is optional and not built.)
- [ ] TikTok audit: posting UI shows creator info, lets the user pick the
      privacy level and confirms music / branded-content consent.

## 2. Domain and app

- [ ] Production domain with HTTPS; set `NEXT_PUBLIC_APP_URL=https://<domain>`
      (no trailing slash) and redeploy.
- [ ] Supabase Auth → URL configuration: Site URL and redirect URLs on the new domain.
- [ ] Generate production `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET`; store them in
      a password manager (losing the key forces every user to reconnect).
- [ ] Background jobs running (Vercel Pro cron or pg_cron/n8n) — check
      `/api/cron/publish` returns 200 and a scheduled test post goes out.
- [ ] Apply all migrations to production (`supabase db push`).

## 3. Stripe live mode

- [ ] Activate the Stripe account (business details, bank account, tax settings / Stripe Tax).
- [ ] Recreate products and monthly prices in live mode; set live `STRIPE_PRICE_*`
      in Supabase secrets and the Next.js env.
- [ ] Live `STRIPE_SECRET_KEY`, live webhook endpoint (5 events, see README) and
      its `STRIPE_WEBHOOK_SECRET`; `APP_URL` secret on the production domain.
- [ ] Customer portal configured in live mode (cancel, switch plans, invoices).
- [ ] Deploy `stripe-checkout`, `stripe-portal`, `stripe-webhook --no-verify-jwt`.
- [ ] One real purchase, upgrade and cancel ([docs/stripe-testing.md](stripe-testing.md)), then refund.

## 4. Email

- [ ] Resend: add and verify the sending domain (SPF, DKIM, DMARC DNS records);
      set `RESEND_API_KEY` and `EMAIL_FROM` on that domain.
- [ ] Supabase Auth emails: custom SMTP (e.g. Resend SMTP) so sign-up / reset
      emails are not rate-limited by the default sender.

## 5. Data protection

- [ ] Supabase: Pro plan with daily backups; enable **Point-in-Time Recovery**
      for production; test a restore once.
- [ ] Privacy policy (`/privacy`) updated for social data: which platform data is
      stored (account ids, names, avatars, encrypted tokens, post ids, metrics),
      why, retention, that tokens are encrypted, how to disconnect / delete, and
      each platform's required disclosures (YouTube: link to Google's privacy
      policy and the YouTube Terms of Service; Google API Services User Data Policy
      "Limited Use"). A "Connected Social Accounts" section covering these
      (and linking `/data-deletion`) is in place; still to do: retention periods,
      the company name / contact details (the page still names a placeholder
      company) and a legal review.
- [ ] Terms (`/terms`) updated: users are responsible for content published to
      their accounts; subscription, renewal, cancellation and refund terms.
- [x] Account deletion (Settings → Danger zone, `DELETE /api/account`) cancels
      the Stripe subscriptions immediately, deletes the user's media files and
      deletes the auth user (cascades all rows, including social tokens).
- [ ] Set `STRIPE_SECRET_KEY` (live) in the **Next.js** server env as well as in
      Supabase secrets — without it, users with a Stripe customer cannot delete
      their account. Test one deletion of a subscribed test user.

## 6. Monitoring and alerts

- [ ] Error tracking for the Next.js app (e.g. Sentry) and log drains.
- [ ] Uptime check on the app and an alert if `/api/cron/publish` stops
      succeeding (e.g. a heartbeat monitor pinged by the scheduler, or alert on
      posts stuck in `scheduled` past their time).
- [ ] Stripe: email alerts for failed webhook deliveries (Developers → Webhooks).
- [ ] Watch Supabase Edge Function logs (`stripe-webhook`) and database usage.
- [ ] Track publish failure rates per platform and token expiries (notifications
      of type `publish_failed` / `account_expired`).
- [ ] Calendar reminders: LinkedIn API version sunset, Meta Graph API version
      deprecation, X credit balance / spending limit.
