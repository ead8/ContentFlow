"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Settings, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchAccountSummary, type AccountSummaryData } from "@/lib/api/client"
import { platformLabel } from "@/lib/platforms"

export function AccountSummary() {
  const [account, setAccount] = useState<AccountSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccountSummary()
      .then(setAccount)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Account</CardTitle>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-muted-foreground">Unable to load account: {error}</p>}
        {account && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold">
                {account.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.plan.name} plan</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Your platforms</h4>
              {account.platforms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {account.platforms.map((p) => (
                    <Badge key={p} variant="secondary">{platformLabel(p)}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href="/onboarding" className="text-primary underline-offset-4 hover:underline">
                    Finish onboarding
                  </Link>{" "}
                  to tell us where you post.
                </p>
              )}
            </div>

            {account.niche && (
              <div>
                <h4 className="mb-1 text-sm font-medium">Niche</h4>
                <p className="text-sm text-muted-foreground">{account.niche}</p>
              </div>
            )}

            {account.upgradeAvailable && (
              <Link
                href="/billing"
                className="flex items-start gap-2 rounded-md bg-primary/5 p-3 transition-colors hover:bg-primary/10"
              >
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Need more credits?</p>
                  <p className="text-xs text-muted-foreground">Compare plans and upgrade any time.</p>
                </div>
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
