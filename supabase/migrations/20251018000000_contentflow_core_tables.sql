/*
  ContentFlow core tables

  Creates every table the application code references that was missing from
  the initial migrations, with Row Level Security so users can only ever
  touch their own rows.

  Tables:
    - user_preference      (onboarding answers)
    - usage                (per-type credit pools used by the generate wizard)
    - credit_transactions  (audit log for the profiles.credits wallet)
    - social_accounts      (connected social profiles + OAuth tokens)
    - content_posts        (user content, drafts / scheduled / published)
    - post_targets         (per-platform publish targets for a post)
    - post_analytics       (engagement events per post)
    - platform_analytics   (daily aggregate metrics per social account)
    - calendar_events      (scheduled content calendar)

  Also adds profiles.is_onboarded, which the onboarding flow expects.
*/

-- ---------------------------------------------------------------------------
-- profiles: onboarding flag expected by the app
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT;

-- ---------------------------------------------------------------------------
-- user_preference
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preference (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  business_type TEXT,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  niche_title TEXT,
  niche_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- usage (credit pools consumed by the generate wizard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  image_credits_used INTEGER NOT NULL DEFAULT 0,
  video_credits_used INTEGER NOT NULL DEFAULT 0,
  total_image_credits INTEGER NOT NULL DEFAULT 50,
  total_video_credits INTEGER NOT NULL DEFAULT 10,
  locked_out BOOLEAN NOT NULL DEFAULT false,
  trial_expiry TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- credit_transactions (audit log for the profiles.credits wallet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  balance_after INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- social_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  -- NOTE: tokens are stored as received. For production, encrypt these at
  -- rest (e.g. Supabase Vault) instead of persisting plaintext.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);

-- ---------------------------------------------------------------------------
-- content_posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  media_urls TEXT[],
  content_type TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  tone TEXT NOT NULL DEFAULT 'professional',
  language TEXT NOT NULL DEFAULT 'en',
  generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- post_targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.content_posts(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- post_analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.content_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  engagement_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- platform_analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers_count INTEGER,
  total_impressions INTEGER,
  total_clicks INTEGER,
  total_shares INTEGER,
  total_comments INTEGER,
  total_likes INTEGER,
  engagement_rate NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (social_account_id, metric_date)
);

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  event_type TEXT NOT NULL DEFAULT 'post',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON public.usage (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON public.social_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_user_id ON public.content_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts (status);
CREATE INDEX IF NOT EXISTS idx_post_targets_post_id ON public.post_targets (post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON public.post_analytics (post_id);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_user_id ON public.platform_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON public.calendar_events (event_date);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Helper: drop policy if it exists so the migration is re-runnable
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'user_preference', 'usage', 'credit_transactions', 'social_accounts',
    'content_posts', 'calendar_events', 'platform_analytics'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Users manage own %s" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t, t
    );
  END LOOP;
END
$$;

-- post_targets / post_analytics are owned through their parent post
DROP POLICY IF EXISTS "Users manage own post_targets" ON public.post_targets;
CREATE POLICY "Users manage own post_targets" ON public.post_targets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.content_posts
      WHERE content_posts.id = post_targets.post_id
        AND content_posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_posts
      WHERE content_posts.id = post_targets.post_id
        AND content_posts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own post_analytics" ON public.post_analytics;
CREATE POLICY "Users manage own post_analytics" ON public.post_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.content_posts
      WHERE content_posts.id = post_analytics.post_id
        AND content_posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_posts
      WHERE content_posts.id = post_analytics.post_id
        AND content_posts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Auto-provision a usage row when a profile is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usage (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();
