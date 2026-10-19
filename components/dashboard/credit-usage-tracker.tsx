"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { fetchCreditUsage, type CreditUsageSummary } from "@/lib/api/client"

export function CreditUsageTracker() {
  const [usage, setUsage] = useState<CreditUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCreditUsage()
      .then(setUsage)
      .catch((e) => setError(e.message))
  }, [])

  const remainingPct = usage
    ? Math.min(100, Math.round((usage.credits / Math.max(usage.monthly_allowance, 1)) * 100))
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Credits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-muted-foreground">Unable to load credits: {error}</p>
        ) : !usage ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{usage.credits.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">
                  of {usage.monthly_allowance.toLocaleString()} / month
                </span>
              </div>
              <Progress value={remainingPct} className="mt-2 h-2" aria-label="Credits remaining" />
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <dt className="text-muted-foreground">Text this period</dt>
                <dd className="font-medium">{usage.used_by_kind.text}</dd>
              </div>
              <div className="rounded-md border p-2">
                <dt className="text-muted-foreground">Images this period</dt>
                <dd className="font-medium">{usage.used_by_kind.image}</dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground">
              {usage.plan_name} plan · {usage.plan === "free" ? "Tops up" : "Renews"} around{" "}
              {format(new Date(usage.next_refresh_at), "MMM d")}
            </p>

            <Button asChild className="w-full" variant="outline">
              <Link href="/billing">
                {usage.plan === "free" ? "Upgrade plan" : "Manage plan"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
