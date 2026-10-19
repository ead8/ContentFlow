"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowRight, FileText, Image as LucideImage, Info, RefreshCcw, Video } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CREDIT_COSTS } from "@/lib/billing/plans"
import { creditBarClass } from "@/components/credit/credits-badge"
import { formatRefreshDate, percentRemaining, useCreditSummary } from "@/hooks/use-credit-summary"

export function CreditUsageTracker() {
  const { summary, isLoading, refresh } = useCreditSummary()

  const percentLeft = summary ? percentRemaining(summary) : 0
  const nextRefresh = summary ? formatRefreshDate(summary.next_refresh_at) : null
  const kinds = summary
    ? [
        { key: "text", label: "Post generation", icon: FileText, value: summary.used_by_kind?.text ?? 0 },
        { key: "image", label: "Images", icon: LucideImage, value: summary.used_by_kind?.image ?? 0 },
        { key: "video", label: "Videos", icon: Video, value: summary.used_by_kind?.video ?? 0 },
      ].filter((k) => k.key !== "video" || k.value > 0)
    : []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1">
          Credit Usage
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="How credits work" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px]">
                <p>
                  One monthly credit allowance covers all AI features: {CREDIT_COSTS.text} credits per post
                  generation, {CREDIT_COSTS.image} per image.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !summary ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : summary ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center">
                <span className="font-medium">{summary.plan_name}</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{summary.credits.toLocaleString()}</span>
                  {" "}/ {summary.monthly_allowance.toLocaleString()} left
                </span>
              </div>
              <Progress
                value={percentLeft}
                className={cn("h-2", creditBarClass(percentLeft))}
                aria-label={`${summary.credits.toLocaleString()} of ${summary.monthly_allowance.toLocaleString()} monthly credits left`}
              />
              {nextRefresh && (
                <p className="text-xs text-muted-foreground">Refreshes on {nextRefresh}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Used this period: {summary.used_this_period.toLocaleString()} credits
              </p>
              <ul className="space-y-1.5">
                {kinds.map(({ key, label, icon: Icon, value }) => (
                  <li key={key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {label}
                    </span>
                    <span className="font-medium">{value.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button asChild className="w-full" variant="outline">
              <Link href="/settings#billing">
                Upgrade Plan
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Link>
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground py-4">
            Unable to load credit information
            <Button variant="ghost" size="sm" onClick={() => refresh()}>
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
