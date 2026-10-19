/*
  Data deletion: Meta data deletion callback + account deletion support.

  1. data_deletion_requests
     - One row per data deletion request received from a platform (Meta's
       "Data Deletion Request callback", POST /api/social/meta/data-deletion).
     - confirmation_code is returned to Meta and shown to the user on the
       public status page /data-deletion?code=...
     - The platform user id is never stored in clear: external_user_hash is
       an HMAC-SHA256 of it (keyed with the platform app secret).
     - Service role only (RLS on, no policies, no grants to anon/authenticated).

  2. social_accounts lookup by Facebook user
     - Meta accounts store the app-scoped Facebook user id that connected
       them in metadata.fbUserId; index it for the deletion callback.

  3. Account deletion (DELETE /api/account)
     - The route runs as the service role and removes the Stripe mirror rows
       (keyed by customer_id, so they do not cascade from auth.users) before
       deleting the auth user; grant it DELETE on those tables.
*/

-- ---------------------------------------------------------------------------
-- 1. data_deletion_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  external_user_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  accounts_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT data_deletion_requests_status_check
    CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user
  ON public.data_deletion_requests (platform, external_user_hash);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.data_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.data_deletion_requests TO service_role;

-- ---------------------------------------------------------------------------
-- 2. social_accounts lookup by Facebook user id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_accounts_fb_user
  ON public.social_accounts ((metadata ->> 'fbUserId'))
  WHERE platform IN ('Facebook', 'Instagram');

-- ---------------------------------------------------------------------------
-- 3. Account deletion (service role)
-- ---------------------------------------------------------------------------
GRANT SELECT, DELETE ON public.stripe_customers TO service_role;
GRANT SELECT, DELETE ON public.stripe_subscriptions TO service_role;
GRANT SELECT, DELETE ON public.stripe_orders TO service_role;
GRANT SELECT, DELETE ON public.social_accounts TO service_role;

-- ---------------------------------------------------------------------------
-- Account deletion goes through DELETE /api/account, which cancels Stripe
-- subscriptions first. Calling delete_my_account() directly would skip that
-- and leave the customer being billed, so users can no longer call it.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM authenticated;
