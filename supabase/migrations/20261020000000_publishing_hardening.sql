/*
  Publishing hardening (from the security and correctness review of the
  auto-publishing branch).

  1. Legacy plaintext tokens are wiped, not just flagged. Rows written before
     token encryption kept readable access/refresh tokens at rest.

  2. post_targets become server-written only. The analytics sync and the
     publisher trust target rows (social_account_id, external_id); a user who
     could insert targets could point the sync at another user's account.
     Manual "mark as published" now writes through the service role after an
     ownership check.

  3. Token refresh lock. Providers with rotating refresh tokens (X, TikTok)
     invalidate the old refresh token on use; two workers refreshing the same
     account at once made the loser mark a healthy account expired.
     try_lock_token_refresh() is an atomic "acquire if free or stale" lock.
*/

-- 1. Wipe legacy plaintext tokens
UPDATE public.social_accounts
SET access_token = '',
    refresh_token = NULL,
    status = 'expired',
    last_error = 'Please reconnect this account.'
WHERE access_token <> '' AND access_token NOT LIKE 'v1:%';

-- Meta rows without the connecting Facebook user id can't be matched by a
-- Meta data deletion request; wipe them so the reconnect records the id.
UPDATE public.social_accounts
SET access_token = '',
    refresh_token = NULL,
    status = 'expired',
    last_error = 'Please reconnect this account.'
WHERE platform IN ('Facebook', 'Instagram')
  AND coalesce(metadata ->> 'fbUserId', '') = ''
  AND access_token <> '';

-- 2. post_targets: read-only for end users
DROP POLICY IF EXISTS "Users manage own post_targets" ON public.post_targets;
DROP POLICY IF EXISTS "Users read own post_targets" ON public.post_targets;
CREATE POLICY "Users read own post_targets" ON public.post_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_posts
      WHERE content_posts.id = post_targets.post_id
        AND content_posts.user_id = auth.uid()
    )
  );
REVOKE INSERT, UPDATE, DELETE ON public.post_targets FROM anon, authenticated;
GRANT SELECT ON public.post_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_targets TO service_role;

-- 3. Token refresh lock
ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS refresh_locked_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.try_lock_token_refresh(p_account UUID, p_seconds INTEGER DEFAULT 60)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.social_accounts
  SET refresh_locked_until = now() + make_interval(secs => GREATEST(p_seconds, 5))
  WHERE id = p_account
    AND (refresh_locked_until IS NULL OR refresh_locked_until < now());
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.try_lock_token_refresh(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_lock_token_refresh(UUID, INTEGER) TO service_role;
