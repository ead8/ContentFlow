# Stripe billing — test plan

Run in Stripe **test mode** against a local or staging Supabase project.

## Setup

```bash
# Stripe CLI: https://docs.stripe.com/stripe-cli
stripe login

# Local Supabase + functions (skip if testing against a deployed project)
supabase start
supabase functions serve --env-file supabase/.env.local --no-verify-jwt
```

`supabase/.env.local` (functions env) needs `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `APP_URL=http://localhost:3000` and the four
`STRIPE_PRICE_*` test price IDs. (`--no-verify-jwt` is only for local serving;
checkout/portal still check the user token themselves.)

Forward webhooks and copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`
(restart `functions serve` after changing it):

```bash
stripe listen \
  --events checkout.session.completed,invoice.paid,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
  --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
# deployed project: --forward-to https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Useful queries while testing (SQL editor):

```sql
select plan, credits, credits_refreshed_at from profiles where email = 'you@example.com';
select amount, description, balance_after, created_at from credit_transactions
  where user_id = '<uid>' order by created_at desc limit 10;
select * from stripe_subscriptions;
select * from processed_stripe_events order by created_at desc limit 20;
```

## Cases

| # | Action | Expected |
|---|---|---|
| 1 | Signed in, start checkout for `creator` (`createCheckoutSession('creator')` from lib/stripe.ts), pay with `4242 4242 4242 4242` | Redirect to `/settings?billing=success`. `stripe_customers` row for the user; `stripe_subscriptions.status = active`, `price_id` = creator price; `profiles.plan = 'creator'`, `credits = 600`; one "subscription started" transaction (plus at most one "Plan changed" row). |
| 2 | Cancel on the Checkout page | Redirect to `/settings?billing=canceled`; nothing changes. |
| 3 | Start checkout again while subscribed | Function returns 409 `already_subscribed`. |
| 4 | Replay an event: `stripe events resend <evt_id>` for the `invoice.paid` from case 1 (after spending some credits) | Response `{ duplicate: true }`; credits unchanged, no new transaction. |
| 5 | Renewal: create a subscription on a [test clock](https://docs.stripe.com/billing/testing/test-clocks), advance it one month | `invoice.paid` (`subscription_cycle`) resets credits to the plan allowance; one "monthly credits" transaction. |
| 6 | Upgrade in the portal (`createPortalSession()`), creator → growth | `customer.subscription.updated`: `plan = 'growth'`, credits at least 2000. |
| 7 | Downgrade in the portal, growth → creator | `plan = 'creator'`; balance kept until the next renewal resets it to 600. |
| 8 | Cancel at period end in the portal | `cancel_at_period_end = true`, plan unchanged. |
| 9 | Cancel immediately (`stripe subscriptions cancel <sub_id>`) | `customer.subscription.deleted`: `plan = 'free'`, credits = 100. |
| 10 | Failed renewal: card `4000 0000 0000 0341`, advance the test clock | `past_due` keeps the plan; once Stripe marks it `unpaid`/`canceled`, plan drops to `free`. |
| 11 | Bad signature: `curl -X POST <webhook-url> -H 'stripe-signature: t=1,v1=bad' -d '{}'` | 400, nothing recorded. |
| 12 | Unknown price: subscribe a linked customer to a price not in `STRIPE_PRICE_*` | Webhook returns 500 and logs "Unknown Stripe price" (Stripe retries); fix the secrets, then `stripe events resend`. |
| 13 | `stripe trigger customer.subscription.updated` (customer not linked to a user) | 200, logged as ignored; no profile changes. |
| 14 | Portal before ever subscribing | 404 `no_customer`. |

`stripe trigger checkout.session.completed` / `invoice.paid` create fixture
customers that are not linked to any user, so they only exercise signature
verification and the "not linked" path; use real checkouts (cases 1–10) for
plan and credit behaviour.

## Before going live

- Recreate products/prices in live mode and update every `STRIPE_PRICE_*`
  (Supabase secrets and Next.js env), `STRIPE_SECRET_KEY` (live `sk_live_`)
  and the portal configuration.
- Add the live webhook endpoint with the five events and set the live
  `STRIPE_WEBHOOK_SECRET`.
- Run cases 1, 6 and 9 once in live mode with a real card, then refund.
