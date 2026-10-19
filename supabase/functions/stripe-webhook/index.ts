/**
 * Stripe webhook (Supabase Edge Function, Deno).
 *
 * Deploy WITHOUT JWT verification - Stripe does not send a Supabase JWT:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Secrets (supabase secrets set ...):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_CREATOR, STRIPE_PRICE_GROWTH, STRIPE_PRICE_AGENCY, STRIPE_PRICE_ENTERPRISE
 *   (legacy names NEXT_PRIVATE_STRIPE_SECRET_KEY / NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET are still read)
 *
 * Events handled (subscribe the endpoint to exactly these):
 *   checkout.session.completed      link Stripe customer to the user, sync subscription, grant plan
 *   invoice.paid                    monthly refill (subscription_create / subscription_cycle)
 *   customer.subscription.created   sync + plan reconcile
 *   customer.subscription.updated   sync + plan change (upgrade / downgrade / unpaid)
 *   customer.subscription.deleted   sync + downgrade to free
 *
 * Every event id is recorded in public.processed_stripe_events before it is
 * handled, so a redelivered event never grants credits twice. If handling
 * fails the record is removed and a 500 is returned so Stripe retries.
 *
 * Subscription state is always re-read from the Stripe API (not trusted from
 * the event payload), so out-of-order delivery converges on the right state.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('NEXT_PRIVATE_STRIPE_SECRET_KEY') ?? '';
const stripeWebhookSecret =
  Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? Deno.env.get('NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET') ?? '';

const stripe = new Stripe(stripeSecret, {
  httpClient: Stripe.createFetchHttpClient(),
  appInfo: { name: 'ContentFlow', version: '1.0.0' },
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Must match lib/billing/plans.ts (priceEnv) and public.plan_monthly_credits().
type PaidPlan = 'creator' | 'growth' | 'agency' | 'enterprise';
type PlanId = 'free' | PaidPlan;
const PLAN_PRICE_ENV: Record<PaidPlan, string> = {
  creator: 'STRIPE_PRICE_CREATOR',
  growth: 'STRIPE_PRICE_GROWTH',
  agency: 'STRIPE_PRICE_AGENCY',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};
const PLAN_NAMES: Record<PlanId, string> = {
  free: 'Free',
  creator: 'Creator Pro',
  growth: 'Growth Studio',
  agency: 'Agency Elite',
  enterprise: 'Enterprise',
};

function planForPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const [plan, env] of Object.entries(PLAN_PRICE_ENV) as [PaidPlan, string][]) {
    if (Deno.env.get(env) === priceId) return plan;
  }
  return null;
}

/** Subscription statuses that keep the paid plan */
const ENTITLED_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!stripeSecret || !stripeWebhookSecret) {
    console.error('Stripe secrets are not configured');
    return new Response('Stripe is not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('No signature found', { status: 400 });
  }

  // Signature verification needs the exact raw body.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret, undefined, cryptoProvider);
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  // Idempotency: claim the event id. A duplicate delivery hits the primary key.
  const { error: claimError } = await supabase
    .from('processed_stripe_events')
    .insert({ id: event.id, type: event.type });

  if (claimError) {
    if (claimError.code === '23505') {
      return Response.json({ received: true, duplicate: true });
    }
    console.error('Failed to record Stripe event', claimError);
    return Response.json({ error: 'Failed to record event' }, { status: 500 });
  }

  try {
    await handleEvent(event);
    return Response.json({ received: true });
  } catch (error: any) {
    console.error(`Error handling ${event.type} (${event.id}):`, error?.message ?? error);
    // Release the claim so Stripe's retry is processed.
    await supabase.from('processed_stripe_events').delete().eq('id', event.id);
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = idOf(session.customer);
      if (!customerId) return;

      const userId = await linkCustomer(customerId, session.client_reference_id ?? session.metadata?.user_id ?? null);
      if (!userId) throw new Error(`No user for customer ${customerId}`);

      if (session.mode === 'subscription') {
        const sub = await syncSubscription(customerId);
        await reconcilePlan(userId, sub);
      } else if (session.mode === 'payment' && session.payment_status === 'paid') {
        await recordOrder(session, customerId);
      }
      return;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = idOf(invoice.customer);
      if (!customerId) return;
      // Only subscription invoices grant credits.
      const subscriptionId =
        idOf((invoice as any).subscription) ?? idOf((invoice as any).parent?.subscription_details?.subscription);
      if (!subscriptionId) return;

      const userId = await userIdForCustomer(customerId);
      if (!userId) throw new Error(`No user for customer ${customerId}`);

      const sub = await syncSubscription(customerId);
      const plan = entitledPlan(sub);
      const reason = invoice.billing_reason;

      if (plan !== 'free' && (reason === 'subscription_create' || reason === 'subscription_cycle')) {
        // New billing period: reset the balance to the plan's monthly allowance.
        await applyPlan(
          userId,
          plan,
          true,
          reason === 'subscription_create'
            ? `${PLAN_NAMES[plan]} subscription started`
            : `${PLAN_NAMES[plan]} monthly credits`,
        );
      } else {
        await reconcilePlan(userId, sub);
      }
      return;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = idOf(subscription.customer);
      if (!customerId) return;

      const userId = await userIdForCustomer(customerId);
      if (!userId) {
        // Subscription created outside our checkout (e.g. in the Dashboard) for
        // a customer we never linked. Nothing to update.
        console.warn(`Ignoring ${event.type}: customer ${customerId} is not linked to a user`);
        return;
      }

      const sub = await syncSubscription(customerId);
      await reconcilePlan(userId, sub);
      return;
    }
  }
}

function idOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in (value as any)) return String((value as any).id);
  return null;
}

/** User linked to a Stripe customer (stripe_customers, then customer metadata). Never by email. */
async function userIdForCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up customer: ${error.message}`);
  if (data?.user_id) return data.user_id;

  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) return null;
  const metaUser = (customer as Stripe.Customer).metadata?.userId ?? (customer as Stripe.Customer).metadata?.user_id;
  return metaUser ? linkCustomer(customerId, metaUser) : null;
}

/** Ensure stripe_customers maps this customer to the user; returns the user id. */
async function linkCustomer(customerId: string, userId: string | null): Promise<string | null> {
  if (!userId) return userIdForCustomer(customerId);

  const { data: byCustomer, error } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up customer: ${error.message}`);
  if (byCustomer) return byCustomer.user_id;

  const { data: byUser, error: userError } = await supabase
    .from('stripe_customers')
    .select('customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (userError) throw new Error(`Failed to look up customer: ${userError.message}`);
  if (byUser) {
    // The user already has a different customer record; keep the original
    // mapping and use the user id from the checkout session.
    console.warn(`User ${userId} already linked to ${byUser.customer_id}; checkout used ${customerId}`);
    return userId;
  }

  const { error: insertError } = await supabase
    .from('stripe_customers')
    .insert({ user_id: userId, customer_id: customerId });
  if (insertError && insertError.code !== '23505') {
    throw new Error(`Failed to link customer: ${insertError.message}`);
  }
  return userId;
}

/**
 * Re-read the customer's subscriptions from Stripe and store the relevant one
 * (an entitled subscription if there is one, else the most recent).
 */
async function syncSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 10,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  const subscription =
    subscriptions.data.find((s: Stripe.Subscription) => ENTITLED_STATUSES.has(s.status)) ??
    subscriptions.data[0] ??
    null;

  if (!subscription) {
    const { error } = await supabase
      .from('stripe_subscriptions')
      .upsert({ customer_id: customerId, status: 'not_started' }, { onConflict: 'customer_id' });
    if (error) throw new Error(`Failed to store subscription: ${error.message}`);
    return null;
  }

  const item = subscription.items.data[0];
  const pm = subscription.default_payment_method;
  const { error } = await supabase.from('stripe_subscriptions').upsert(
    {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: item?.price?.id ?? null,
      current_period_start: (subscription as any).current_period_start ?? (item as any)?.current_period_start ?? null,
      current_period_end: (subscription as any).current_period_end ?? (item as any)?.current_period_end ?? null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      payment_method_brand: pm && typeof pm !== 'string' ? pm.card?.brand ?? null : null,
      payment_method_last4: pm && typeof pm !== 'string' ? pm.card?.last4 ?? null : null,
      status: subscription.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'customer_id' },
  );
  if (error) throw new Error(`Failed to store subscription: ${error.message}`);
  return subscription;
}

/** Plan the user is entitled to from their subscription */
function entitledPlan(subscription: Stripe.Subscription | null): PlanId {
  if (!subscription || !ENTITLED_STATUSES.has(subscription.status)) return 'free';
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planForPriceId(priceId);
  if (!plan) {
    console.error(`Unknown Stripe price ${priceId}: set the STRIPE_PRICE_* secrets`);
    throw new Error(`Unknown Stripe price ${priceId}`);
  }
  return plan;
}

/**
 * Bring profiles.plan in line with the subscription. No-op when the plan is
 * unchanged, so it is safe to run on every event.
 *  - upgrade / new plan: balance becomes at least the new monthly allowance
 *  - downgrade between paid plans: keep the balance until the next renewal
 *  - back to free (canceled / unpaid): balance reset to the free allowance
 */
async function reconcilePlan(userId: string, subscription: Stripe.Subscription | null) {
  const plan = entitledPlan(subscription);

  const { data: profile, error } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Failed to read profile: ${error.message}`);
  if (!profile) throw new Error(`Profile ${userId} not found`);
  if (profile.plan === plan) return;

  if (plan === 'free') {
    await applyPlan(userId, 'free', true, `Subscription ended (was ${PLAN_NAMES[profile.plan as PlanId] ?? profile.plan})`);
  } else {
    await applyPlan(userId, plan, false, `Plan changed to ${PLAN_NAMES[plan]}`);
  }
}

async function applyPlan(userId: string, plan: PlanId, resetCredits: boolean, description: string) {
  const { error } = await supabase.rpc('apply_plan', {
    p_user: userId,
    p_plan: plan,
    p_reset_credits: resetCredits,
    p_description: description,
  });
  if (error) throw new Error(`apply_plan failed: ${error.message}`);
}

async function recordOrder(session: Stripe.Checkout.Session, customerId: string) {
  const { error } = await supabase.from('stripe_orders').insert({
    checkout_session_id: session.id,
    payment_intent_id: idOf(session.payment_intent) ?? '',
    customer_id: customerId,
    amount_subtotal: session.amount_subtotal ?? 0,
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    payment_status: session.payment_status,
    status: 'completed',
  });
  if (error) throw new Error(`Failed to record order: ${error.message}`);
}
