# ContentFlow

AI-powered social media content creation, scheduling, auto-publishing and
analytics. Built with Next.js 14, TypeScript, Tailwind CSS, Supabase and
Stripe.

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works) and the [Supabase CLI](https://supabase.com/docs/guides/cli)
- An OpenAI-compatible AI API key (OpenAI, OpenRouter, ...)
- Optional: developer apps for each social platform you want to publish to,
  a Stripe account (paid plans) and a Resend account (email notifications)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values (every variable is
   documented in [`.env.example`](.env.example)):

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Required | Where to find it |
   |---|---|---|
   | `NEXT_PUBLIC_APP_URL` | yes | Public URL of the app, no trailing slash (`http://localhost:3000` locally) |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Project Settings → API (server only) |
   | `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_*_MODEL` | yes | Your AI provider |
   | `TOKEN_ENCRYPTION_KEY` | for publishing | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `CRON_SECRET` | for publishing | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `LINKEDIN_*`, `META_*`, `X_*`, `TIKTOK_*`, `GOOGLE_*` | per platform | See [Connecting social platforms](#connecting-social-platforms) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | optional | [resend.com](https://resend.com) (verify the sender domain) |
   | `STRIPE_*` | for billing | See [Billing (Stripe)](#billing-stripe). `STRIPE_SECRET_KEY` (server only) is also required for account deletion once billing is live |

   Without `RESEND_API_KEY`, email is skipped and users only get in-app
   notifications (publish failures, expired accounts, posts that need manual
   publishing). `EMAIL_FROM` must be on a Resend-verified domain (otherwise
   Resend's `onboarding@resend.dev` test sender is used).

   `TOKEN_ENCRYPTION_KEY` encrypts social OAuth tokens at rest. Keep it stable:
   changing it makes stored tokens unreadable and users have to reconnect.

3. Apply the database migrations:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   (or run `supabase/migrations/*.sql` in the SQL editor, in filename order).
   Besides the core tables (`profiles`, `content_posts`, `social_accounts`,
   `post_targets`, `post_analytics`, `calendar_events`, `credit_transactions`,
   ...), the recent migrations add:

   - `20261019000000_hardening_billing_media.sql` — plans and credits
     (`apply_plan`, `spend_credits`), multi-platform posts, `media` storage bucket
   - `20261019100000_auto_publishing.sql` — encrypted social tokens, publishing
     state and retries (`claim_due_posts`), `notifications`
   - `20261019100200_stripe_events.sql` — Stripe webhook idempotency

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. To publish automatically, also set up [background jobs](#background-jobs).
   Without them, scheduled posts stay scheduled (users can still use
   "Publish now").

## Connecting social platforms

Users connect accounts in **Settings → Connected accounts**. Each platform is
enabled once its client id and secret are set. For every platform, register
this exact redirect URI (one per slug):

```
${NEXT_PUBLIC_APP_URL}/api/social/{slug}/callback
```

Slugs: `linkedin`, `facebook`, `instagram`, `x`, `tiktok`, `youtube`. Register
both the `localhost` and the production URL where the platform allows several.

In development mode every platform only works for your own / test accounts.
**Real users can only publish after the platform approves your app**; start
these reviews early (see [docs/launch-checklist.md](docs/launch-checklist.md)
for lead times). Every review asks for a public privacy policy, terms of
service and usually a screencast of the connect + publish flow.

### LinkedIn (`linkedin`)

- App: [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
  (the app must be linked to a LinkedIn Page and verified by a Page admin).
- Auth tab → Authorized redirect URLs: `.../api/social/linkedin/callback`.
- Products: **Sign In with LinkedIn using OpenID Connect** and **Share on
  LinkedIn** (self-serve). Scopes: `openid profile email w_member_social` —
  enough to post on the user's personal profile.
- Company Pages: request the **Community Management API** (scopes
  `r_organization_admin w_organization_social`), then set
  `LINKEDIN_ORG_SCOPES=true`. LinkedIn only accepts this request from an app
  with no other products, for registered legal organizations with a verified
  business email and Page. The Development tier is limited (500 calls/app/day);
  the Standard tier needs a second review with a screencast. The user must be
  an admin (or content poster) of the Page.
- Tokens: access tokens last 60 days and refresh tokens are only issued to
  approved partner apps, so most users must reconnect every 60 days (the
  account shows "Reconnect needed" and they get a notification).
- Metrics: likes/comments on personal posts need the restricted
  `r_member_social` scope, so expect empty metrics for personal posts.
- Optional: `LINKEDIN_API_VERSION` (YYYYMM, default `202610`). LinkedIn sunsets
  each version after about a year; bump it before the default expires.

### Facebook Pages and Instagram (`facebook`, `instagram`)

- App: [developers.facebook.com/apps](https://developers.facebook.com/apps), type
  **Business**, with the **Facebook Login for Business** product. One app
  (`META_APP_ID` / `META_APP_SECRET`) serves both platforms.
- Facebook Login → Settings → Valid OAuth Redirect URIs: both
  `.../api/social/facebook/callback` and `.../api/social/instagram/callback`.
- Permissions: Facebook `pages_show_list pages_read_engagement
  pages_manage_posts read_insights`; Instagram `instagram_basic
  instagram_content_publish instagram_manage_insights pages_show_list
  pages_read_engagement`. Pages owned through a Business portfolio may also
  need `business_management` (`META_EXTRA_SCOPES`). Alternatively create
  Facebook Login for Business configurations and set
  `META_FACEBOOK_CONFIG_ID` / `META_INSTAGRAM_CONFIG_ID`.
- Instagram must be a **Professional (Business or Creator) account linked to a
  Facebook Page**. Instagram needs an image (JPEG) or video on every post and
  limits API publishing per account per 24 h.
- Review: every permission needs **Advanced Access via App Review** (one
  screencast per permission) and **Business Verification**. Until then only
  people with a role on the app can connect. Meta also requires a privacy
  policy URL (`${NEXT_PUBLIC_APP_URL}/privacy`) and a data deletion URL in the
  app settings.
- Data deletion: App settings → Basic → **Data deletion requests** → "Data
  deletion callback URL" = `${NEXT_PUBLIC_APP_URL}/api/social/meta/data-deletion`.
  Meta POSTs a `signed_request` (verified with `META_APP_SECRET`); the app
  deletes the Facebook / Instagram accounts that Facebook user connected and
  returns a confirmation code with a status page
  (`${NEXT_PUBLIC_APP_URL}/data-deletion?code=...`). `/data-deletion` also has
  general deletion instructions. Accounts are matched by the Facebook user id
  stored at connect time (`metadata.fbUserId`), so accounts connected before
  this was added must be reconnected once to be matchable.
- Optional: `META_GRAPH_VERSION` (default `v26.0`).

### X / Twitter (`x`)

- App: [developer.x.com](https://developer.x.com) → Projects & Apps → your app
  → User authentication settings: OAuth 2.0, type **Web App (confidential
  client)**, permissions **Read and write**, callback `.../api/social/x/callback`.
  Use the OAuth 2.0 Client ID / Secret (`X_CLIENT_ID` / `X_CLIENT_SECRET`).
- Scopes: `tweet.read tweet.write users.read offline.access media.write`.
- Access: posting needs a **paid API plan**. New developer accounts are on
  pay-per-use (no free tier since February 2026): buy credits in the
  Developer Console and set a spending limit. Each post is billed (posts that
  contain a URL cost more); check current prices in the console. Without
  credits, publishing fails with a 402 error shown to the user.

### TikTok (`tiktok`)

- App: [developers.tiktok.com](https://developers.tiktok.com) → Manage apps.
  Add **Login Kit** (redirect URI `.../api/social/tiktok/callback`) and the
  **Content Posting API** with **Direct Post** enabled.
- Scopes: `user.info.basic user.info.profile user.info.stats video.publish
  video.list` (override with `TIKTOK_SCOPES`; each must be enabled on the app).
  Video only.
- Review: the app itself must pass TikTok's app review to leave sandbox. Then
  the **Content Posting API audit**: until it passes, every post is forced to
  **private (`SELF_ONLY`)**, and only private TikTok accounts can be posted to.
  The audit checks the posting UX (creator info shown, user-chosen privacy
  level, music / branded-content consent). Optional `TIKTOK_PRIVACY_LEVEL`.

### YouTube Shorts (`youtube`)

- App: [Google Cloud Console](https://console.cloud.google.com) → enable
  **YouTube Data API v3** → OAuth consent screen (External) → Credentials →
  OAuth client ID, type **Web application**, redirect URI
  `.../api/social/youtube/callback` (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
- Scopes: `youtube.upload`, `youtube.readonly` (sensitive scopes).
- Review: while the consent screen is in **Testing**, only listed test users
  (max 100) can connect and refresh tokens expire after 7 days. Publishing the
  app requires **Google OAuth verification** (homepage, privacy policy,
  verified domain, demo video). Separately, videos uploaded by a project that
  has not passed the **YouTube API Services audit** are locked to private;
  the audit is also how you get more upload quota.
- Shorts must be vertical or square and at most 3 minutes. Optional
  `YOUTUBE_PRIVACY_STATUS` (`public` | `unlisted` | `private`).

## Background jobs

Two endpoints do the background work. Both require
`Authorization: Bearer $CRON_SECRET` and accept GET or POST:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/publish` | every minute | Publish due scheduled posts and due retries |
| `/api/cron/sync-analytics` | every 6 hours | Refresh post metrics from the platforms |

Runs can take a few minutes (video uploads, Instagram/TikTok processing), so
the routes set `maxDuration = 300`; give your scheduler a matching timeout.

**Vercel Cron**: `vercel.json` already schedules both. Set `CRON_SECRET` in the
Vercel project env; Vercel sends it as the bearer token. Per-minute schedules
need a **Pro** plan (Hobby runs cron jobs at most once a day), which also
allows the 300 s function duration that video uploads need.

**Any other scheduler** works the same way. For example Supabase `pg_cron` +
`pg_net` (enable both under Database → Extensions; the same snippet is in the
comment at the top of `app/api/cron/publish/route.ts`):

```sql
select cron.schedule('contentflow-publish', '* * * * *', $$
  select net.http_post(
    url := 'https://app.example.com/api/cron/publish',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET',
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000);
$$);

select cron.schedule('contentflow-sync-analytics', '0 */6 * * *', $$
  select net.http_post(
    url := 'https://app.example.com/api/cron/sync-analytics',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET',
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000);
$$);
```

(Store the secret in Supabase Vault rather than inline if you prefer.) With
n8n: a **Schedule Trigger** (every minute / every 6 hours) followed by an
**HTTP Request** node (POST, header `Authorization: Bearer <CRON_SECRET>`,
timeout 300 s). Manual test:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish
```

## Billing (Stripe)

Plans and monthly credit allowances are defined in `lib/billing/plans.ts`
(kept in sync with `plan_monthly_credits()` in SQL). Checkout, the customer
portal and the webhook are Supabase Edge Functions in `supabase/functions/`.

1. In Stripe, create one product per paid plan (Creator Pro, Growth Studio,
   Agency Elite, Enterprise) with a **recurring monthly price**.
2. Configure the customer portal (Settings → Billing → Customer portal):
   allow cancellation, payment method updates and switching between the four
   prices.
3. Set the secrets and deploy the functions:

   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... \
     APP_URL=https://app.example.com \
     STRIPE_PRICE_CREATOR=price_... STRIPE_PRICE_GROWTH=price_... \
     STRIPE_PRICE_AGENCY=price_... STRIPE_PRICE_ENTERPRISE=price_...
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-portal
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

   Set the same `STRIPE_PRICE_*` and `STRIPE_SECRET_KEY` in the Next.js env.
   `STRIPE_SECRET_KEY` is **required** there for account deletion
   (`DELETE /api/account` cancels the user's subscriptions immediately); without
   it, users who have a Stripe customer cannot delete their account. It also
   lets `GET /api/credits/plans` show live prices.
4. Add a webhook endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   for the events `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.

How it works: a paid invoice for a new period (`subscription_create` /
`subscription_cycle`) resets the balance to the plan's monthly allowance;
upgrades take effect immediately; a canceled or unpaid subscription drops the
user to Free. Every event id is stored in `processed_stripe_events`, so
redelivered events never add credits twice. Users are matched by the Stripe
customer created at checkout (`client_reference_id` / customer metadata),
never by email. The test plan is in [docs/stripe-testing.md](docs/stripe-testing.md).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs type checking) |
| `npm run lint` | ESLint |

## API routes

Routes return `{ success, data }` / `{ success: false, error }` and require a
signed-in session unless noted.

- `GET/POST /api/posts` — list / create posts
- `GET/PATCH/DELETE /api/posts/[id]` — read / update / delete a post
- `POST /api/posts/[id]/publish` — `{ mode: 'auto', platforms? }` publishes
  now through connected accounts (also used to retry); `{ platforms: [{ platform, url? }] }`
  marks platforms as published manually
- `POST /api/posts/[id]/metrics` — record engagement numbers manually
- `GET/PATCH/DELETE /api/social-accounts` — list connected accounts and
  configured platforms / set the default account / disconnect
- `DELETE /api/account` — `{ confirm: "DELETE" }` permanently deletes the
  account: cancels Stripe subscriptions, deletes media files and the auth user
  (cascades all rows), signs out
- `POST /api/social/meta/data-deletion` — Meta data deletion callback
  (`signed_request`, no session); status page `/data-deletion?code=...`
- `GET /api/social/[slug]/connect?returnTo=/settings` — start OAuth (redirect)
- `GET /api/social/[slug]/callback` — OAuth callback (redirects back to `returnTo`)
- `GET/POST /api/notifications` — list / mark read
- `GET /api/analytics` — engagement metrics
- `GET /api/credits` — balance and plan; `?type=transactions` for history
- `GET /api/credits/plans` — plans with live Stripe prices and the current plan
- `GET/POST/PUT/DELETE /api/calendar` — scheduled events
- `POST /api/ai/generate`, `POST /api/ai/image` — AI generation (spends credits)
- `GET /api/dashboard/{account,credits,performance,stats}` — dashboard data
- `POST /api/feedback` — send feedback
- `GET|POST /api/cron/publish`, `GET|POST /api/cron/sync-analytics` — background
  jobs (`Authorization: Bearer $CRON_SECRET`, no session)

Supabase Edge Functions (`/functions/v1/...`): `stripe-checkout`,
`stripe-portal` (user access token), `stripe-webhook` (Stripe signature).

## Security notes

- Social OAuth tokens are encrypted by the app with AES-256-GCM
  (`TOKEN_ENCRYPTION_KEY`) and are only readable by the service role; users can
  see non-secret account columns only.
- Users cannot change their own plan or credit balance; credits are spent via
  `spend_credits()` and granted only by `apply_plan()` (Stripe webhook) or the
  free monthly top-up.
- Before launch, work through [docs/launch-checklist.md](docs/launch-checklist.md).
