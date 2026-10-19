/**
 * Start a Stripe Checkout session for a subscription plan (Supabase Edge Function, Deno).
 *
 * POST /functions/v1/stripe-checkout
 *   Authorization: Bearer <user access token>
 *   { "plan": "creator" | "growth" | "agency" | "enterprise", "success_url"?: string, "cancel_url"?: string }
 * -> { sessionId, url }
 *
 * The price is resolved server-side from the STRIPE_PRICE_* secrets, so the
 * client cannot pick an arbitrary price. A legacy { price_id } body is still
 * accepted when it matches one of those prices.
 *
 * Users who already have a live subscription get 409 and should use the
 * billing portal (stripe-portal) to change or cancel their plan, so nobody
 * ends up paying for two subscriptions.
 *
 * Secrets: STRIPE_SECRET_KEY (or legacy NEXT_PRIVATE_STRIPE_SECRET_KEY),
 *          STRIPE_PRICE_CREATOR / _GROWTH / _AGENCY / _ENTERPRISE,
 *          APP_URL (optional; the app's public URL - redirect URLs must be on it)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('NEXT_PRIVATE_STRIPE_SECRET_KEY') ?? '';
const stripe = new Stripe(stripeSecret, {
  httpClient: Stripe.createFetchHttpClient(),
  appInfo: { name: 'ContentFlow', version: '1.0.0' },
});

// Must match lib/billing/plans.ts (priceEnv).
type PaidPlan = 'creator' | 'growth' | 'agency' | 'enterprise';
const PLAN_PRICE_ENV: Record<PaidPlan, string> = {
  creator: 'STRIPE_PRICE_CREATOR',
  growth: 'STRIPE_PRICE_GROWTH',
  agency: 'STRIPE_PRICE_AGENCY',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};

/** Subscription statuses that mean "already subscribed" */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/** Redirect URLs must stay on the app (APP_URL, else the caller's origin). */
function safeRedirect(req: Request, value: unknown, fallbackPath: string): string | null {
  const base = (Deno.env.get('APP_URL') || req.headers.get('Origin') || '').replace(/\/+$/, '');
  if (!base) return null;
  if (value == null || value === '') return `${base}${fallbackPath}`;
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, base);
    if (url.origin !== new URL(base).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function resolvePrice(plan: unknown, priceId: unknown): { plan: PaidPlan; price: string } | { error: string } {
  if (typeof plan === 'string') {
    if (!(plan in PLAN_PRICE_ENV)) return { error: `Unknown plan "${plan}"` };
    const price = Deno.env.get(PLAN_PRICE_ENV[plan as PaidPlan]);
    if (!price) return { error: `The ${plan} plan is not available yet` };
    return { plan: plan as PaidPlan, price };
  }
  if (typeof priceId === 'string') {
    for (const [p, env] of Object.entries(PLAN_PRICE_ENV) as [PaidPlan, string][]) {
      if (Deno.env.get(env) === priceId) return { plan: p, price: priceId };
    }
    return { error: 'Unknown price' };
  }
  return { error: 'Missing plan' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405);
  }
  if (!stripeSecret) {
    return json(req, { error: 'Billing is not configured' }, 503);
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json(req, { error: 'Not authenticated' }, 401);

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);
    if (getUserError || !user) {
      return json(req, { error: 'Not authenticated' }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json(req, { error: 'Invalid JSON body' }, 400);
    }

    const resolved = resolvePrice(body.plan, body.price_id);
    if ('error' in resolved) return json(req, { error: resolved.error }, 400);

    const successUrl = safeRedirect(req, body.success_url, '/settings?billing=success');
    const cancelUrl = safeRedirect(req, body.cancel_url, '/settings?billing=canceled');
    if (!successUrl || !cancelUrl) {
      return json(req, { error: 'Invalid success_url or cancel_url' }, 400);
    }

    // Find or create the Stripe customer for this user.
    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer', getCustomerError);
      return json(req, { error: 'Failed to fetch customer information' }, 500);
    }

    let customerId: string;

    if (customer?.customer_id) {
      customerId = customer.customer_id;

      // Block a second subscription; plan changes go through the portal.
      const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      if (existing.data.some((s: Stripe.Subscription) => LIVE_STATUSES.has(s.status))) {
        return json(
          req,
          { error: 'You already have a subscription. Use "Manage billing" to change or cancel your plan.', code: 'already_subscribed' },
          409,
        );
      }
    } else {
      const newCustomer = await stripe.customers.create(
        { email: user.email, metadata: { userId: user.id } },
        { idempotencyKey: `customer-${user.id}` },
      );

      const { error: createCustomerError } = await supabase
        .from('stripe_customers')
        .insert({ user_id: user.id, customer_id: newCustomer.id });

      if (createCustomerError && createCustomerError.code !== '23505') {
        console.error('Failed to save customer mapping', createCustomerError);
        return json(req, { error: 'Failed to create customer mapping' }, 500);
      }
      if (createCustomerError) {
        // A concurrent request created the mapping first; use that customer.
        const { data: raced } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', user.id)
          .maybeSingle();
        customerId = raced?.customer_id ?? newCustomer.id;
      } else {
        customerId = newCustomer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      mode: 'subscription',
      line_items: [{ price: resolved.price, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { user_id: user.id, plan: resolved.plan },
      subscription_data: { metadata: { user_id: user.id, plan: resolved.plan } },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return json(req, { sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error?.message ?? error}`);
    return json(req, { error: 'Could not start checkout. Please try again.' }, 500);
  }
});
