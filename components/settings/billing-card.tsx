"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Check, CreditCard, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  BillingError,
  createCheckoutSession,
  createPortalSession,
  getActiveSubscription,
  type ActiveSubscription,
  type PaidPlanId,
} from "@/lib/stripe"
import type { PlanId } from "@/lib/billing/plans"
import type { PlanPrice, PlanWithPrice } from "@/lib/billing/prices"
import type { CreditBalance } from "@/lib/services/credits"
import { notifyCreditsChanged } from "@/lib/n8n/client"

/** Subscription states Stripe Checkout refuses a second subscription for (mirrors stripe-checkout) */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"])

/** Plan the user was on when they left for Checkout, to detect the webhook's update on return */
const PREV_PLAN_KEY = "contentflow.billing.prevPlan"

const POLL_INTERVAL_MS = 3000
const POLL_ATTEMPTS = 6 // immediate + every 3s for ~15s

const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
])

interface BillingData {
  plans: PlanWithPrice[]
  currentPlan: PlanId
  balance: CreditBalance
  subscription: ActiveSubscription | null
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

async function fetchBilling(): Promise<BillingData> {
  const [plansData, balance, subscription] = await Promise.all([
    api<{ plans: PlanWithPrice[]; currentPlan: PlanId }>("/api/credits/plans"),
    api<CreditBalance>("/api/credits"),
    getActiveSubscription(),
  ])
  return {
    plans: plansData.plans,
    // /api/credits is fetched alongside; prefer its plan if the two disagree mid-update
    currentPlan: (balance.plan as PlanId) || plansData.currentPlan,
    balance,
    subscription,
  }
}

function formatPrice(price: PlanPrice): { amount: string; interval: string | null } {
  const currency = price.currency.toUpperCase()
  const value = ZERO_DECIMAL.has(price.currency.toLowerCase()) ? price.amount : price.amount / 100
  let amount: string
  try {
    amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    amount = `${value} ${currency}`
  }
  const interval =
    price.interval === "month" ? "/month" : price.interval === "year" ? "/year" : price.interval ? `/${price.interval}` : null
  return { amount, interval }
}

function formatDate(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
}

function readPrevPlan(): string | null {
  try {
    const value = window.sessionStorage.getItem(PREV_PLAN_KEY)
    window.sessionStorage.removeItem(PREV_PLAN_KEY)
    return value
  } catch {
    return null
  }
}

function storePrevPlan(plan: string) {
  try {
    window.sessionStorage.setItem(PREV_PLAN_KEY, plan)
  } catch {
    /* storage unavailable: fall back to assuming the free plan */
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function LoadingState() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BillingCardFallback() {
  return (
    <Card id="billing" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Plan &amp; billing</CardTitle>
        <CardDescription>Loading your plan…</CardDescription>
      </CardHeader>
      <CardContent>
        <LoadingState />
      </CardContent>
    </Card>
  )
}

export function BillingCard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const handledParams = useRef(false)
  const mounted = useRef(true)

  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Plan id being checked out, or "portal" */
  const [busy, setBusy] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async (opts: { silent?: boolean } = {}): Promise<BillingData | null> => {
    if (!opts.silent) {
      setLoading(true)
      setLoadError(null)
    }
    try {
      const next = await fetchBilling()
      if (mounted.current) {
        setData(next)
        setLoadError(null)
      }
      return next
    } catch (e: any) {
      if (mounted.current && !opts.silent) setLoadError(e?.message || "Could not load your plan.")
      return null
    } finally {
      if (mounted.current && !opts.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // After Checkout the webhook updates the plan a moment later: poll for ~15s until it changes.
  const waitForPlanChange = useCallback(async () => {
    const baseline = readPrevPlan() ?? "free"
    setSyncing(true)
    try {
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        if (attempt > 0) await sleep(POLL_INTERVAL_MS)
        if (!mounted.current) return
        const next = await load({ silent: true })
        if (next && next.currentPlan !== baseline) {
          notifyCreditsChanged()
          const plan = next.plans.find((p) => p.id === next.currentPlan)
          toast({
            title: "Plan updated",
            description: `You're now on ${plan?.name ?? next.balance.plan_name}. ${next.balance.credits.toLocaleString()} credits are ready to use.`,
          })
          return
        }
      }
      if (mounted.current) {
        toast({
          title: "Still processing your payment",
          description: "Your plan should update within a minute. Refresh this page to check again.",
        })
      }
    } finally {
      if (mounted.current) setSyncing(false)
    }
  }, [load, toast])

  // Result of the Stripe round trip: ?billing=success | ?billing=canceled
  useEffect(() => {
    if (handledParams.current) return
    const status = searchParams.get("billing")
    if (status !== "success" && status !== "canceled") return
    handledParams.current = true

    if (status === "success") {
      toast({ title: "Payment received — your plan will update in a few seconds" })
      waitForPlanChange()
    } else {
      try {
        window.sessionStorage.removeItem(PREV_PLAN_KEY)
      } catch {
        /* ignore */
      }
      toast({ title: "Checkout canceled", description: "No changes were made to your plan." })
    }

    const rest = new URLSearchParams(searchParams.toString())
    rest.delete("billing")
    const qs = rest.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [searchParams, pathname, router, toast, waitForPlanChange])

  // Honour /settings#billing once the card has content
  useEffect(() => {
    if (loading) return
    if (typeof window !== "undefined" && window.location.hash === "#billing") {
      cardRef.current?.scrollIntoView({ block: "start" })
    }
  }, [loading])

  /** busyKey: which button shows the spinner ("portal" or the plan being switched to) */
  const openPortal = async (busyKey = "portal") => {
    setBusy(busyKey)
    try {
      window.location.assign(await createPortalSession())
    } catch (e: any) {
      setBusy(null)
      if (e instanceof BillingError && e.code === "no_customer") {
        toast({ title: "No billing account yet", description: "Choose a paid plan to start a subscription." })
      } else {
        toast({ variant: "destructive", title: "Could not open billing portal", description: e?.message })
      }
    }
  }

  const startCheckout = async (plan: PlanWithPrice) => {
    if (plan.id === "free" || !data) return
    setBusy(plan.id)
    try {
      storePrevPlan(data.currentPlan)
      window.location.assign(await createCheckoutSession(plan.id as PaidPlanId))
    } catch (e: any) {
      if (e instanceof BillingError && e.code === "already_subscribed") {
        toast({ title: "You already have a subscription", description: "Opening the billing portal to change your plan…" })
        await openPortal(plan.id)
        return
      }
      setBusy(null)
      toast({ variant: "destructive", title: "Could not start checkout", description: e?.message })
    }
  }

  const subscription = data?.subscription ?? null
  const hasLiveSubscription = !!subscription?.subscription_status && LIVE_STATUSES.has(subscription.subscription_status)
  const currentPlan = data?.plans.find((p) => p.id === data.currentPlan) ?? null
  const isPaid = !!data && data.currentPlan !== "free"
  const canManage = hasLiveSubscription || isPaid || !!subscription?.customer_id

  // Features every plan shares are listed once under the grid
  const sharedFeatures =
    data && data.plans.length > 1
      ? data.plans[0].features.filter((f) => data.plans.every((p) => p.features.includes(f)))
      : []

  const balance = data?.balance
  const allowance = balance?.monthly_allowance || currentPlan?.monthlyCredits || 0
  const percentLeft = balance && allowance > 0 ? Math.min(100, Math.round((balance.credits / allowance) * 100)) : 0
  const periodEnd = formatDate(subscription?.current_period_end)
  const status = subscription?.subscription_status

  return (
    <Card id="billing" ref={cardRef} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Plan &amp; billing</CardTitle>
        <CardDescription>
          AI credits are used for post generation and images. Your allowance resets each month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <span className="sr-only" role="status">
              Loading your plan…
            </span>
            <LoadingState />
          </>
        ) : loadError || !data || !balance ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{loadError || "Could not load your plan."}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current plan + balance */}
            <section aria-labelledby="billing-current" className="rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
                  <h3 id="billing-current" className="text-lg font-semibold">
                    {currentPlan?.name ?? balance.plan_name}
                  </h3>
                  {hasLiveSubscription && periodEnd && (
                    <p className="text-xs text-muted-foreground">
                      {subscription?.cancel_at_period_end ? `Ends on ${periodEnd}` : `Renews on ${periodEnd}`}
                      {subscription?.payment_method_last4 && (
                        <>
                          {" · "}
                          <span className="capitalize">{subscription.payment_method_brand || "Card"}</span> ••••{" "}
                          {subscription.payment_method_last4}
                        </>
                      )}
                    </p>
                  )}
                </div>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => openPortal()} disabled={busy !== null}>
                    {busy === "portal" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Manage billing
                    <ExternalLink className="ml-2 h-3 w-3 opacity-60" aria-hidden="true" />
                  </Button>
                )}
              </div>

              {(status === "past_due" || status === "unpaid") && (
                <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Your last payment failed. Update your payment method in Manage billing to keep your plan.
                </p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    <span className="text-base font-semibold">{balance.credits.toLocaleString()}</span>{" "}
                    <span className="text-muted-foreground">credits left</span>
                  </span>
                  <span className="text-muted-foreground">{allowance.toLocaleString()} / month</span>
                </div>
                <Progress
                  value={percentLeft}
                  className="h-2"
                  aria-label={`${balance.credits.toLocaleString()} of ${allowance.toLocaleString()} monthly credits left`}
                />
              </div>

              {syncing && (
                <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Updating your plan…
                </p>
              )}
            </section>

            {/* Plan grid */}
            <section aria-labelledby="billing-plans" className="space-y-3">
              <h3 id="billing-plans" className="text-sm font-medium">
                {isPaid ? "Change plan" : "Upgrade for more credits"}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.plans.map((plan) => {
                  const isCurrent = plan.id === data.currentPlan
                  const price = plan.price ? formatPrice(plan.price) : null
                  const ownFeatures = plan.features.filter((f) => !sharedFeatures.includes(f))
                  const isUpgrade = plan.monthlyCredits > (currentPlan?.monthlyCredits ?? 0)
                  const actionLabel = isUpgrade ? "Upgrade" : "Switch"
                  const planBusy = busy === plan.id

                  return (
                    <li
                      key={plan.id}
                      className={cn(
                        "flex flex-col rounded-lg border p-4",
                        isCurrent && "border-primary ring-1 ring-primary"
                      )}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold">{plan.name}</h4>
                        {isCurrent && (
                          <Badge variant="secondary" className="shrink-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>

                      <p className="mt-3">
                        {plan.id === "free" ? (
                          <span className="text-2xl font-bold">Free</span>
                        ) : price ? (
                          <>
                            <span className="text-2xl font-bold">{price.amount}</span>
                            {price.interval && <span className="text-sm text-muted-foreground">{price.interval}</span>}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Price shown at checkout</span>
                        )}
                      </p>
                      <p className="text-sm font-medium text-primary">
                        {plan.monthlyCredits.toLocaleString()} credits / month
                      </p>

                      {ownFeatures.length > 0 && (
                        <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                          {ownFeatures.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4">
                        {isCurrent ? (
                          <p className="text-center text-sm text-muted-foreground">Your current plan</p>
                        ) : plan.id === "free" ? (
                          <p className="text-center text-xs text-muted-foreground">
                            {isPaid ? "Cancel anytime in Manage billing" : "Included with every account"}
                          </p>
                        ) : !plan.purchasable ? (
                          <Button className="w-full" variant="outline" disabled title="This plan isn't available yet.">
                            Unavailable
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant={isUpgrade ? "default" : "outline"}
                            disabled={busy !== null}
                            onClick={() => (hasLiveSubscription ? openPortal(plan.id) : startCheckout(plan))}
                            aria-label={`${actionLabel} to ${plan.name}`}
                          >
                            {planBusy ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : isUpgrade ? (
                              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                            ) : null}
                            {actionLabel}
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {sharedFeatures.length > 0 && (
                <div className="rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium">Every plan includes</p>
                  <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                    {sharedFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Payments are handled securely by Stripe. Plan changes, cancellations and invoices are in Manage
                billing.
              </p>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default BillingCard
