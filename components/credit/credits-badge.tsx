"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FileText, Image as LucideImage, RefreshCcw, Video } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRefreshDate, percentRemaining, useCreditSummary } from "@/hooks/use-credit-summary"

/** Progress bar colour for the share of the monthly allowance left */
export function creditBarClass(percentLeft: number) {
  if (percentLeft <= 10) return "[&>div]:bg-red-600"
  if (percentLeft <= 25) return "[&>div]:bg-amber-500"
  return "[&>div]:bg-green-600"
}

export function CreditsBadge() {
  const { summary, isLoading, error, refresh } = useCreditSummary()

  if (isLoading && !summary) {
    return (
      <div className="flex items-center h-8 px-2 rounded-md bg-gray-100 dark:bg-gray-800">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (!summary) {
    if (!error) return null
    return (
      <button
        type="button"
        onClick={() => refresh()}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-label="Retry loading credits"
      >
        <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Credits unavailable
      </button>
    )
  }

  const percentLeft = percentRemaining(summary)
  const nextRefresh = formatRefreshDate(summary.next_refresh_at)
  const kinds = [
    { key: "text", label: "Posts", icon: FileText, value: summary.used_by_kind?.text ?? 0 },
    { key: "image", label: "Images", icon: LucideImage, value: summary.used_by_kind?.image ?? 0 },
    { key: "video", label: "Videos", icon: Video, value: summary.used_by_kind?.video ?? 0 },
  ].filter((k) => k.key !== "video" || k.value > 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center rounded-md px-1 py-0.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${summary.credits.toLocaleString()} of ${summary.monthly_allowance.toLocaleString()} monthly credits left. Show credit details`}
        >
          <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Image src="/images/icons/credit.svg" alt="" width={36} height={36} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-[88px]">
            <span className="text-sm font-medium leading-none">
              {summary.credits.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}/ {summary.monthly_allowance.toLocaleString()}
              </span>
            </span>
            <Progress value={percentLeft} className={cn("h-1.5", creditBarClass(percentLeft))} />
            <span className="text-[11px] leading-none text-muted-foreground">Credits left</span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{summary.plan_name} plan</p>
            <p className="text-xs text-muted-foreground">
              {summary.credits.toLocaleString()} of {summary.monthly_allowance.toLocaleString()} monthly credits left
            </p>
          </div>
          <span className="text-sm font-bold">{percentLeft}%</span>
        </div>
        <Progress value={percentLeft} className={cn("h-2", creditBarClass(percentLeft))} />

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

        {nextRefresh && (
          <p className="text-xs text-muted-foreground">Credits refresh on {nextRefresh}</p>
        )}

        <Button asChild size="sm" className="w-full">
          <Link href="/settings#billing">
            Upgrade
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
