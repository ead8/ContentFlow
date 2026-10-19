/**
 * @deprecated Plans are defined in lib/billing/plans.ts. Stripe Price IDs are
 * no longer hard-coded: they come from the STRIPE_PRICE_* environment
 * variables (Next.js env and Supabase Edge Function secrets).
 */
export { PLANS, getPlan } from '@/lib/billing/plans'
export type { Plan, PlanId as ProductId } from '@/lib/billing/plans'
