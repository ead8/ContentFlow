/*
  Production hardening, billing plans, multi-platform posts and media storage.

  1. Security
     - Disable the hard-coded admin account an earlier migration created
       (admin@intuity.ai, password published in the repo).
     - Users can no longer write their own credit balance, plan or role:
       profiles UPDATE is limited to profile fields, and usage /
       credit_transactions become read-only for end users.
     - Credits are spent through spend_credits(), which checks and deducts
       the balance in a single atomic UPDATE (no read-then-write race).

  2. Plans
     - profiles.plan + profiles.credits_refreshed_at. Free accounts get their
       monthly allowance topped up lazily (no cron needed); paid plans are
       refilled by the Stripe webhook on each paid invoice.
     - Allowances must match lib/billing/plans.ts.

  3. Posts
     - content_posts.platforms / platform_variants keep the per-platform copy
       the AI wizard generates (previously only the first platform was kept).
     - post_targets no longer require a connected social account, so a post
       can be tracked as published per platform.
     - post_analytics holds one current value per post/platform/metric.

  4. Storage
     - Public "media" bucket; users can only write inside their own
       <user_id>/ folder.

  5. Account deletion
     - delete_my_account() removes the caller's auth user (cascades to all
       of their rows).
*/

-- ---------------------------------------------------------------------------
-- 1. Disable the seeded backdoor account, if it exists
-- ---------------------------------------------------------------------------
UPDATE auth.users
SET encrypted_password = '',
    banned_until = 'infinity'
WHERE id = 'c9d53d6d-7c99-4bd0-8103-4a9f83b6b1fc'
  AND email = 'admin@intuity.ai';

-- ---------------------------------------------------------------------------
-- 2. Plans on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS credits_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Earlier code stored the plan in profiles.role; carry it over.
UPDATE public.profiles
SET plan = role
WHERE role IN ('creator', 'growth', 'agency', 'enterprise')
  AND plan = 'free';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'creator', 'growth', 'agency', 'enterprise'));

-- New accounts start with the free monthly allowance.
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 100;

CREATE OR REPLACE FUNCTION public.plan_monthly_credits(p_plan TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'creator' THEN 600
    WHEN 'growth' THEN 2000
    WHEN 'agency' THEN 6000
    WHEN 'enterprise' THEN 20000
    ELSE 100
  END
$$;

-- Copy name / user type from sign-up metadata into the profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'user_type', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Lock down self-service writes to billing columns
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, user_type, is_onboarded) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users manage own usage" ON public.usage;
DROP POLICY IF EXISTS "Users read own usage" ON public.usage;
CREATE POLICY "Users read own usage" ON public.usage
  FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.usage FROM anon, authenticated;

DROP POLICY IF EXISTS "Users manage own credit_transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users read own credit_transactions" ON public.credit_transactions;
CREATE POLICY "Users read own credit_transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS kind TEXT;

-- ---------------------------------------------------------------------------
-- 4. Credit functions
-- ---------------------------------------------------------------------------

-- Top up a free account to its monthly allowance once per month.
CREATE OR REPLACE FUNCTION public.refresh_free_credits(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_allowance INTEGER;
  v_balance INTEGER;
BEGIN
  UPDATE public.profiles
  SET credits = GREATEST(credits, public.plan_monthly_credits(plan)),
      credits_refreshed_at = now()
  WHERE id = p_user
    AND plan = 'free'
    AND credits_refreshed_at <= now() - interval '1 month'
  RETURNING public.plan_monthly_credits(plan), credits
  INTO v_allowance, v_balance;

  IF FOUND THEN
    INSERT INTO public.credit_transactions
      (user_id, amount, transaction_type, description, kind, balance_after)
    VALUES
      (p_user, 0, 'refill', 'Monthly free credits', 'refill', v_balance);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_free_credits(UUID) FROM PUBLIC, anon, authenticated;

-- Current user's balance and plan (applies the free monthly top-up first).
CREATE OR REPLACE FUNCTION public.get_my_credits()
RETURNS TABLE (
  credits INTEGER,
  plan TEXT,
  monthly_allowance INTEGER,
  credits_refreshed_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.refresh_free_credits(v_uid);

  RETURN QUERY
  SELECT p.credits, p.plan, public.plan_monthly_credits(p.plan), p.credits_refreshed_at
  FROM public.profiles p
  WHERE p.id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_credits() TO authenticated;

-- Atomically spend the caller's credits. Raises 'Insufficient credits' if
-- the balance is too low; never lets the balance go negative.
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_amount INTEGER,
  p_kind TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS public.credit_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_balance INTEGER;
  v_tx public.credit_transactions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('text', 'image', 'video') THEN
    RAISE EXCEPTION 'Invalid credit kind' USING ERRCODE = '22023';
  END IF;

  PERFORM public.refresh_free_credits(v_uid);

  UPDATE public.profiles
  SET credits = credits - p_amount
  WHERE id = v_uid AND credits >= p_amount
  RETURNING credits INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, kind, balance_after)
  VALUES
    (v_uid, -p_amount, 'deduction', p_description, p_kind, v_balance)
  RETURNING * INTO v_tx;

  UPDATE public.usage
  SET image_credits_used = image_credits_used + CASE WHEN p_kind = 'image' THEN 1 ELSE 0 END,
      video_credits_used = video_credits_used + CASE WHEN p_kind = 'video' THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_credits(INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(INTEGER, TEXT, TEXT) TO authenticated;

-- Plan changes from billing (service role only).
CREATE OR REPLACE FUNCTION public.apply_plan(
  p_user UUID,
  p_plan TEXT,
  p_reset_credits BOOLEAN,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_balance INTEGER;
  v_balance INTEGER;
BEGIN
  SELECT credits INTO v_old_balance FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE public.profiles
  SET plan = p_plan,
      credits = CASE
        WHEN p_reset_credits THEN public.plan_monthly_credits(p_plan)
        ELSE GREATEST(credits, public.plan_monthly_credits(p_plan))
      END,
      credits_refreshed_at = now()
  WHERE id = p_user
  RETURNING credits INTO v_balance;

  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, description, kind, balance_after)
  VALUES
    (p_user, v_balance - v_old_balance, 'refill',
     COALESCE(p_description, 'Plan credits: ' || p_plan), 'refill', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_plan(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_plan(UUID, TEXT, BOOLEAN, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Multi-platform posts
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS platforms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS platform_variants JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.content_posts
  DROP CONSTRAINT IF EXISTS content_posts_status_check;
ALTER TABLE public.content_posts
  ADD CONSTRAINT content_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'published'));

CREATE INDEX IF NOT EXISTS idx_content_posts_scheduled_for
  ON public.content_posts (user_id, scheduled_for)
  WHERE status = 'scheduled';

ALTER TABLE public.post_targets
  ALTER COLUMN social_account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS external_url TEXT;

DELETE FROM public.post_targets a
USING public.post_targets b
WHERE a.post_id = b.post_id
  AND a.platform = b.platform
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_targets_post_platform
  ON public.post_targets (post_id, platform);

-- Keep only the newest value per post / platform / metric, then enforce it.
DELETE FROM public.post_analytics a
USING public.post_analytics b
WHERE a.post_id = b.post_id
  AND a.platform = b.platform
  AND a.engagement_type = b.engagement_type
  AND a.recorded_at < b.recorded_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_analytics_metric
  ON public.post_analytics (post_id, platform, engagement_type);

-- ---------------------------------------------------------------------------
-- 6. Media storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Media: users read own folder" ON storage.objects;
CREATE POLICY "Media: users read own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Media: users upload to own folder" ON storage.objects;
CREATE POLICY "Media: users upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Media: users update own folder" ON storage.objects;
CREATE POLICY "Media: users update own folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Media: users delete own folder" ON storage.objects;
CREATE POLICY "Media: users delete own folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 7. Account deletion
-- ---------------------------------------------------------------------------
ALTER TABLE public.stripe_customers
  DROP CONSTRAINT IF EXISTS stripe_customers_user_id_fkey;
ALTER TABLE public.stripe_customers
  ADD CONSTRAINT stripe_customers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.stripe_subscriptions
  WHERE customer_id IN (SELECT customer_id FROM public.stripe_customers WHERE user_id = v_uid);
  DELETE FROM public.stripe_orders
  WHERE customer_id IN (SELECT customer_id FROM public.stripe_customers WHERE user_id = v_uid);

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
