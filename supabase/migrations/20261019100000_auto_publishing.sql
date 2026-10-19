/*
  Auto-publishing: connected social accounts, a background publisher and
  in-app notifications.

  1. social_accounts
     - Tokens are stored AES-256-GCM encrypted by the app
       (TOKEN_ENCRYPTION_KEY); the columns keep their names but never hold
       plaintext.
     - New columns for token expiry, account type, avatar, provider metadata,
       connection status and a per-platform default account.
     - End users can read their accounts' non-secret columns and delete
       them; only the service role (OAuth callback, publisher) can write or
       read tokens.

  2. Publishing state
     - content_posts.status gains 'publishing', 'partially_published' and
       'failed'.
     - post_targets keep their history when an account is disconnected
       (social_account_id is set to NULL instead of cascading).
     - post_targets track which account a platform was published with, the
       provider's post id, attempts and the next retry time. Target status is
       one of pending | publishing | published | failed | needs_manual.
     - claim_due_posts() atomically moves due scheduled posts (and stale
       'publishing' claims) to 'publishing' so concurrent cron runs never
       publish the same post twice.

  3. notifications
     - In-app notifications (publish failures, reconnect prompts). Users can
       read their own and mark them read; the service role creates them.
*/

-- ---------------------------------------------------------------------------
-- 1. social_accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'profile',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_status_check;
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_status_check
  CHECK (status IN ('active', 'expired', 'error'));

-- Tokens stored before this migration were plaintext; they cannot be used
-- with the encrypted format, so ask those users to reconnect.
UPDATE public.social_accounts
SET status = 'expired', last_error = 'Please reconnect this account.'
WHERE access_token NOT LIKE 'v1:%';

-- At most one default account per user and platform
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_accounts_default
  ON public.social_accounts (user_id, platform)
  WHERE is_default;

-- Users see non-secret columns only; writes go through the service role.
DROP POLICY IF EXISTS "Users manage own social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users read own social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Users delete own social_accounts" ON public.social_accounts;
CREATE POLICY "Users read own social_accounts" ON public.social_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own social_accounts" ON public.social_accounts
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.social_accounts FROM anon, authenticated;
GRANT SELECT (
  id, user_id, platform, account_id, account_name, account_type, avatar_url,
  status, last_error, is_default, is_connected, token_expires_at, last_synced,
  created_at, updated_at
) ON public.social_accounts TO authenticated;
GRANT DELETE ON public.social_accounts TO authenticated;

-- Make another account the default for its platform (owner only).
CREATE OR REPLACE FUNCTION public.set_default_social_account(p_account UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_platform TEXT;
BEGIN
  SELECT platform INTO v_platform
  FROM public.social_accounts
  WHERE id = p_account AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.social_accounts
  SET is_default = false, updated_at = now()
  WHERE user_id = v_uid AND platform = v_platform AND is_default AND id <> p_account;

  UPDATE public.social_accounts
  SET is_default = true, updated_at = now()
  WHERE id = p_account;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_social_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_social_account(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Publishing state
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS publish_claimed_at TIMESTAMPTZ;

ALTER TABLE public.content_posts
  DROP CONSTRAINT IF EXISTS content_posts_status_check;
ALTER TABLE public.content_posts
  ADD CONSTRAINT content_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'partially_published', 'failed'));

CREATE INDEX IF NOT EXISTS idx_content_posts_due
  ON public.content_posts (scheduled_for)
  WHERE status IN ('scheduled', 'publishing');

ALTER TABLE public.post_targets
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics_synced_at TIMESTAMPTZ;

-- Disconnecting an account must keep the post's publish history.
ALTER TABLE public.post_targets
  DROP CONSTRAINT IF EXISTS post_targets_social_account_id_fkey;
ALTER TABLE public.post_targets
  ADD CONSTRAINT post_targets_social_account_id_fkey
  FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.post_targets
  DROP CONSTRAINT IF EXISTS post_targets_status_check;
ALTER TABLE public.post_targets
  ADD CONSTRAINT post_targets_status_check
  CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'needs_manual'));

CREATE INDEX IF NOT EXISTS idx_post_targets_retry
  ON public.post_targets (next_attempt_at)
  WHERE status = 'failed' AND next_attempt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_targets_metrics
  ON public.post_targets (metrics_synced_at)
  WHERE status = 'published' AND external_id IS NOT NULL;

/*
  Claim up to p_limit posts that are ready to publish:
    - scheduled posts whose time has come
    - posts with failed targets whose retry time has come
    - posts stuck in 'publishing' for more than 15 minutes (crashed run)
  Claimed posts are set to 'publishing' with publish_claimed_at = now().
  Service role only.
*/
CREATE OR REPLACE FUNCTION public.claim_due_posts(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.content_posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.content_posts p
  SET status = 'publishing', publish_claimed_at = now(), updated_at = now()
  WHERE p.id IN (
    SELECT c.id
    FROM public.content_posts c
    WHERE (c.status = 'scheduled' AND c.scheduled_for <= now())
       OR (c.status = 'publishing' AND c.publish_claimed_at < now() - interval '15 minutes')
       OR (c.status IN ('partially_published', 'failed') AND EXISTS (
             SELECT 1 FROM public.post_targets t
             WHERE t.post_id = c.id
               AND t.status = 'failed'
               AND t.next_attempt_at IS NOT NULL
               AND t.next_attempt_at <= now()))
    ORDER BY c.scheduled_for NULLS LAST
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_posts(INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
