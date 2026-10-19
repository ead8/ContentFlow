/*
  Stripe webhook idempotency.

  The stripe-webhook Edge Function inserts each event id here before handling
  it. A redelivered (or concurrently delivered) event hits the primary key and
  is skipped, so invoice.paid can never refill credits twice. If handling
  fails, the function deletes the row so Stripe's retry is processed.

  Service role only (RLS on, no policies, no grants to anon/authenticated).
*/

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.processed_stripe_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.processed_stripe_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_created
  ON public.processed_stripe_events (created_at);

-- The webhook writes these as the service role; make sure it can when the
-- project does not grant table privileges by default.
GRANT SELECT, INSERT, UPDATE ON public.stripe_customers TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stripe_subscriptions TO service_role;
GRANT SELECT, INSERT ON public.stripe_orders TO service_role;
GRANT SELECT ON public.profiles TO service_role;
