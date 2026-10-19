/**
 * Open the Stripe customer portal (Supabase Edge Function, Deno), where users
 * update payment methods, download invoices, switch plans and cancel.
 *
 * POST /functions/v1/stripe-portal
 *   Authorization: Bearer <user access token>
 *   { "return_url"?: string }      (defaults to APP_URL/settings)
 * -> { url }
 *
 * Plan switching and cancellation must be enabled in the Stripe Dashboard:
 * Settings -> Billing -> Customer portal (add the four plan prices as the
 * products customers can switch between). Changes made there reach the app
 * through the stripe-webhook function (customer.subscription.updated / deleted).
 *
 * Secrets: STRIPE_SECRET_KEY (or legacy NEXT_PRIVATE_STRIPE_SECRET_KEY),
 *          APP_URL (optional; return URLs must be on it),
 *          STRIPE_PORTAL_CONFIGURATION (optional bpc_... id; default portal config otherwise)
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

function safeReturnUrl(req: Request, value: unknown): string | null {
  const base = (Deno.env.get('APP_URL') || req.headers.get('Origin') || '').replace(/\/+$/, '');
  if (!base) return null;
  if (value == null || value === '') return `${base}/settings`;
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, base);
    return url.origin === new URL(base).origin ? url.toString() : null;
  } catch {
    return null;
  }
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
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return json(req, { error: 'Not authenticated' }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }

    const returnUrl = safeReturnUrl(req, body.return_url);
    if (!returnUrl) return json(req, { error: 'Invalid return_url' }, 400);

    const { data: customer, error } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch customer', error);
      return json(req, { error: 'Failed to fetch billing account' }, 500);
    }
    if (!customer?.customer_id) {
      return json(req, { error: 'No billing account yet. Choose a plan first.', code: 'no_customer' }, 404);
    }

    const configuration = Deno.env.get('STRIPE_PORTAL_CONFIGURATION') || undefined;
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customer_id,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });

    return json(req, { url: session.url });
  } catch (error: any) {
    console.error(`Portal error: ${error?.message ?? error}`);
    return json(req, { error: 'Could not open the billing portal. Please try again.' }, 500);
  }
});
