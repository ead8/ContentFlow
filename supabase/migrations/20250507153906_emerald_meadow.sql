/*
  Intentionally empty.

  This migration used to insert a hard-coded admin account
  (admin@intuity.ai) with a password published in the source code. That is a
  backdoor in every environment the migrations run against, so it was
  removed. 20261019000000_hardening_billing_media.sql disables that account
  on databases where it was already created.

  For local development, create users through the app's sign-up page or the
  Supabase Studio instead (see supabase/seed.sql).
*/
SELECT 1;
