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
| Publishing | **Assisted, not automatic.** Each platform version has *Copy* and *Open {platform}* (pre-filled for X and LinkedIn), then *Mark as published* with an optional live URL. ContentFlow does not post to social networks on the user's behalf. Direct publishing needs each platform's developer app and review (Meta, LinkedIn, X, TikTok, Google). |
| Analytics | Users enter each platform's numbers on a published post; the Analytics page aggregates them. There is no automatic metrics import. |
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
2. **AI provider:** set `OPENAI_BASE_URL`, `OPENAI_API_KEY` and models. Do not
   use the keyless Pollinations endpoint in production.
3. **Stripe (optional):** create a monthly Price per paid plan, set
   `STRIPE_PRICE_*`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and add
   a webhook endpoint `https://<domain>/api/billing/webhook` for
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` and
   `invoice.paid`; set `STRIPE_WEBHOOK_SECRET`. Enable the customer portal in
   Stripe settings.
4. **Host:** any Node host (Vercel works out of the box). Set all variables
   from `.env.example`, including `NEXT_PUBLIC_APP_URL` and
   `NEXT_PUBLIC_SUPPORT_EMAIL`.
5. **Legal:** `app/privacy` and `app/terms` are generic templates; have them
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
