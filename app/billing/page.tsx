"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { Check, Coins, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import {
  api,
  fetchCreditTransactions,
  fetchCreditUsage,
  openBillingPortal,
  startCheckout,
  type CreditTransaction,
  type CreditUsageSummary,
} from "@/lib/api/client"
import { CREDIT_COSTS } from "@/lib/billing/plans"

interface PlanInfo {
  id: string
  name: string
  description: string
  monthlyCredits: number
  features: string[]
  price: { amount: number; currency: string; interval: string | null } | null
  purchasable: boolean
}

function formatPrice(price: PlanInfo["price"]) {
  if (!price) return null
  const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(
    price.amount / 100
  )
  return price.interval ? `${amount} / ${price.interval}` : amount
}

function BillingContent() {
  const { toast } = useToast()
  const { refreshProfile } = useAuth()
  const searchParams = useSearchParams()

  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [configured, setConfigured] = useState(false)
  const [usage, setUsage] = useState<CreditUsageSummary | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api<{ configured: boolean; plans: PlanInfo[] }>("/api/billing/plans")
      .then((d) => {
        setPlans(d.plans)
        setConfigured(d.configured)
      })
      .catch((e) => toast({ variant: "destructive", title: "Could not load plans", description: e.message }))
    fetchCreditUsage().then(setUsage).catch(() => undefined)
    fetchCreditTransactions(25).then(setTransactions).catch(() => undefined)
  }, [toast])

  useEffect(() => {
    const status = searchParams.get("checkout")
    if (status === "success") {
      toast({ title: "Thanks for subscribing!", description: "Your plan and credits update within a few seconds." })
      // The webhook may land a moment after the redirect
      const t = setTimeout(() => {
        refreshProfile()
        fetchCreditUsage().then(setUsage).catch(() => undefined)
      }, 3000)
      return () => clearTimeout(t)
    }
    if (status === "cancelled") toast({ title: "Checkout cancelled" })
  }, [searchParams, toast, refreshProfile])

  const go = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    try {
      window.location.href = await fn()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Billing error", description: e.message })
      setBusy(null)
    }
  }

  const currentPlan = usage?.plan ?? "free"

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Plans & Billing</h1>
        <p className="text-sm text-muted-foreground">
          Generating a post costs {CREDIT_COSTS.text} credits, an image costs {CREDIT_COSTS.image}. Credits refresh monthly.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Coins className="h-6 w-6 text-primary" />
            </div>
            {usage ? (
              <div>
                <p className="text-2xl font-bold">{usage.credits.toLocaleString()} credits</p>
                <p className="text-sm text-muted-foreground">
                  {usage.plan_name} plan · {usage.monthly_allowance.toLocaleString()} per month · next refresh around{" "}
                  {format(new Date(usage.next_refresh_at), "MMM d")}
                </p>
              </div>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
          {configured && currentPlan !== "free" && (
            <Button variant="outline" onClick={() => go("portal", openBillingPortal)} disabled={busy !== null}>
              {busy === "portal" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage billing
            </Button>
          )}
        </CardContent>
      </Card>

      {!configured && plans && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Paid plans aren&apos;t available yet. Check back soon.
        </p>
      )}

      {!plans ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="pt-2 text-2xl font-bold">
                    {plan.id === "free" ? "Free" : formatPrice(plan.price) ?? "—"}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.id === "free" ? null : isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>Your plan</Button>
                  ) : currentPlan !== "free" ? (
                    <Button variant="outline" className="w-full" onClick={() => go("portal", openBillingPortal)} disabled={busy !== null}>
                      Switch plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => go(plan.id, () => startCheckout(plan.id))}
                      disabled={!plan.purchasable || busy !== null}
                    >
                      {busy === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Upgrade
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credit history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(t.created_at), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>{t.description || t.transaction_type}</TableCell>
                    <TableCell className={`text-right ${t.amount < 0 ? "text-destructive" : "text-green-600"}`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </TableCell>
                    <TableCell className="text-right">{t.balance_after ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  )
}
