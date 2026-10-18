# ContentFlow

AI-powered social media content creation, scheduling, and analytics. Built with
Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An n8n instance (for AI content generation, dashboard stats, and media
  generation) — optional for browsing the UI, required for generation features

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
   | `NEXT_PUBLIC_N8N_API_URL` / `NEXT_PUBLIC_N8N_API_KEY` | Your n8n instance |
   | `NEXT_PUBLIC_N8N_*_WEBHOOK_URL` | n8n webhook nodes for each feature |

3. Apply the database migrations to your Supabase project:

   ```bash
   supabase db push
   ```

   (or run `supabase/migrations/*.sql` in the Supabase SQL editor, in filename
   order). This creates the `profiles` table extensions plus `content_posts`,
   `social_accounts`, `calendar_events`, `usage`, `credit_transactions`,
   `post_targets`, `post_analytics`, `platform_analytics`, and
   `user_preference`, all with Row Level Security.

4. Run the dev server:

   ```bash
   npm run dev
   ```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs type checking) |
| `npm run lint` | ESLint |

## API routes

All routes require an authenticated session (cookies) and return
`{ success, data }` / `{ success: false, error }`.

- `GET/POST /api/posts` — list / create posts
- `PUT /api/posts` — update a post (`{ postId, ...updates }`)
- `DELETE /api/posts?postId=…` — delete a post
- `POST /api/posts/[id]/publish` — publish (`{ targetAccountIds }`)
- `GET/POST /api/social-accounts` — list / connect social accounts
- `GET/POST /api/analytics` — engagement metrics
- `GET/POST /api/credits` — balance, transactions, deduct/add/refill
- `GET/POST/PUT/DELETE /api/calendar` — scheduled events

## Notes

- OAuth tokens for connected social accounts are stored in `social_accounts`.
  Encrypt them at rest (e.g. Supabase Vault) before production use.
- `NEXT_PUBLIC_N8N_API_KEY` is read in browser code; for production, proxy n8n
  calls through a server route instead of exposing the key.
