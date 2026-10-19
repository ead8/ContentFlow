"use client"

import Link from "next/link"
import { Coins } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "../auth-provider"
import { CREDIT_COSTS, getPlan } from "@/lib/billing/plans"

/**
 * Header badge with the current credit balance; links to billing.
 */
export function CreditsBadge() {
  const { user } = useAuth()
  if (!user) return null

  const plan = getPlan(user.plan)
  const low = user.credits < CREDIT_COSTS.image

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/billing"
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted ${
              low ? "border-amber-500/50 text-amber-600 dark:text-amber-400" : "border-border"
            }`}
            aria-label={`${user.credits} credits available`}
          >
            <Coins className="h-4 w-4" />
            <span>{user.credits.toLocaleString()}</span>
            <span className="hidden text-muted-foreground lg:inline">credits</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{plan.name} plan</p>
          <p className="text-xs text-muted-foreground">
            {plan.monthlyCredits.toLocaleString()} credits per month. Text generation costs {CREDIT_COSTS.text},
            images cost {CREDIT_COSTS.image}.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
