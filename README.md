# ContentFlow

AI-assisted social media content creation. Describe an idea once, get
platform-tailored posts for LinkedIn, Instagram, X, Facebook, TikTok and
YouTube Shorts, add AI-generated or uploaded media, schedule it on a content
calendar, and track how each post performs.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
(Postgres, Auth, Storage) and any OpenAI-compatible AI provider. Billing via
Stripe.

## What the product does (and doesn't)

| Feature | How it works |
|---|---|
| Sign up / sign in | Email + 6-digit code, then a password. Password reset by email. |
| AI copy | One prompt → a version per platform, editable, with live character limits. 10 credits. |
| AI images | Generated, then copied into the user's storage folder (provider URLs expire). 25 credits. |
| Media | Upload images (≤10 MB) and videos (≤50 MB); media library with delete. |
| Scheduling | Save drafts or schedule a date/time; due posts show in the in-app notification bell. |
| Publishing | **Automatic** for platforms the user has connected in Settings (LinkedIn, Facebook Pages, Instagram, X, TikTok, YouTube): scheduled posts are published by a background job, with per-platform status, retries and failure alerts; *Publish now* / *Retry* on the post page. Platforms without a connected account fall back to *Copy* + *Open {platform}* + *Mark as published*. Each platform needs its developer app (see below). |
| Analytics | Synced automatically every 6 hours from each platform's API for auto-published posts; numbers can also be entered by hand on any published post. |
| Email | Publish failures and expired accounts are emailed via Resend or any SMTP server (`EMAIL_PROVIDER`). Auth emails go through Supabase Auth's SMTP settings. |
| Credits & plans | Free plan: 100 credits/month (auto top-up). Paid plans via Stripe Checkout; renewals reset the monthly allowance. |
| Account | Profile, password change, account deletion (cancels Stripe subscription, removes data and media). |

## Local development

Prerequisites: Node.js 18+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start          # Postgres, Auth, Storage, Mailpit on 5432x ports
npx supabase status -o env  # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY
cp .env.example .env.local  # fill in Supabase + AI values
npm run dev
```

Sign-up emails (with the 6-digit code) are caught by Mailpit at
http://127.0.0.1:54324.

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

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server (build fails on type or lint errors) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | End-to-end suite against a running app + **local** Supabase (refuses to run against a remote project). Set `SKIP_AI=1` to skip AI calls. |

The E2E suite covers sign-up via emailed code, every API route, credits,
billing plan application, monthly top-ups, account deletion, and attacks that
must fail (self-granting credits/plans, forging transactions, cross-user
access, cross-folder uploads, the CVE-2025-29927 middleware bypass header).

## Deploying to production

1. **Supabase project**
   - Apply migrations: `npx supabase link --project-ref <ref>` then
     `npx supabase db push`.
   - Auth → URL configuration: set Site URL to your domain and add
     `https://<domain>/**` to redirect URLs.
   - Auth → Email templates: the sign-up screen asks for a **6-digit code**,
     so the *Confirm signup* and *Magic link* templates must include
     `{{ .Token }}` (Supabase's defaults contain only a link). Copy
     `supabase/templates/*.html`.
   - Configure a real SMTP provider (Supabase's built-in sender is heavily
     rate-limited).
2. **AI provider:** set `AI_PROVIDER=openai` (or `openrouter`) and
   `OPENAI_API_KEY`. The keyless `pollinations` preset is for demos only.
3. **Email:** set `EMAIL_PROVIDER` + Resend or SMTP credentials and
   `EMAIL_FROM` on a verified domain; configure the same SMTP server in
   Supabase (Authentication → SMTP) for sign-up and password emails.
4. **Background jobs and social apps:** set `TOKEN_ENCRYPTION_KEY`,
   `CRON_SECRET`, schedule the cron endpoints and create each platform's
   app (sections below).
5. **Stripe (optional):** create a monthly Price per paid plan, set
   `STRIPE_PRICE_*`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and add
   a webhook endpoint `https://<domain>/api/billing/webhook` for
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` and
   `invoice.paid`; set `STRIPE_WEBHOOK_SECRET`. Enable the customer portal in
   Stripe settings.
6. **Host:** any Node host (Vercel works out of the box). Set all variables
   from `.env.example`, including `NEXT_PUBLIC_APP_URL` and
   `NEXT_PUBLIC_SUPPORT_EMAIL`.
7. **Legal:** `app/privacy` and `app/terms` are generic templates; have them
   reviewed for your jurisdiction and business before launch.

## Architecture notes

- **Credits are enforced in Postgres.** Users cannot write `profiles.credits`,
  `plan` or `role` (column-level grants), and `usage` / `credit_transactions`
  are read-only to them. Spending goes through `spend_credits()`, a single
  atomic `UPDATE … WHERE credits >= cost`. Plan changes go through
  `apply_plan()`, callable only by the service role (Stripe webhook).
- AI routes check the balance before calling the provider and charge only
  after success, so failed generations are never billed.
- All tables use Row Level Security; storage writes are limited to the
  user's own `<user_id>/` folder in the `media` bucket.
- `lib/billing/plans.ts` is the single source of plan allowances and must
  match `plan_monthly_credits()` in the migrations.

## API

All routes need a signed-in session cookie and return `{ success, data }` or
`{ success: false, error }` (401 unauthenticated, 402 out of credits, 400
invalid input, 404 not found).

- `GET/POST /api/posts`, `GET/PATCH/DELETE /api/posts/:id`
- `POST /api/posts/:id/publish`, `POST /api/posts/:id/metrics`
- `POST /api/ai/generate`, `POST /api/ai/image`
- `GET /api/credits[?type=transactions]`
- `GET/POST/PUT/DELETE /api/calendar`
- `GET /api/analytics`, `GET /api/notifications`, `GET /api/dashboard/*`
- `GET /api/billing/plans` (public), `POST /api/billing/checkout`,
  `POST /api/billing/portal`, `POST /api/billing/webhook` (Stripe-signed)
- `POST /api/feedback`, `DELETE /api/account`
