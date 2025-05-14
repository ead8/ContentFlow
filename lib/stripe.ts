import { products } from '@/src/stripe-config';
import { createClient } from '@/lib/supabase/client';

export async function createCheckoutSession(priceId: string, mode: 'payment' | 'subscription') {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      price_id: priceId,
      mode,
      success_url: `${window.location.origin}/checkout/success`,
      cancel_url: `${window.location.origin}/checkout/cancel`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();

  if (!url) {
    throw new Error('No checkout URL returned');
  }

  return url;
}

export async function getActiveSubscription() {
  const supabase = createClient();
  
  const { data: subscription, error } = await supabase
    .from('stripe_user_subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    return null;
  }

  if (!subscription) {
    return null;
  }

  // Find the product that matches the subscription's price_id
  const product = Object.entries(products).find(([_, product]) => product.priceId === subscription.price_id);

  if (!product) {
    return null;
  }

  const [productId, productDetails] = product;

  return {
    ...subscription,
    product: {
      id: productId,
      ...productDetails,
    },
  };
}