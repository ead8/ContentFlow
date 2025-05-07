"use client"

import { Suspense } from "react"
import { PostPerformanceOverview } from "@/components/dashboard/post-performance-overview"
import { ContentCreationShortcuts } from "@/components/dashboard/content-creation-shortcuts"
import { CreditUsageTracker } from "@/components/dashboard/credit-usage-tracker"
import { AccountSummary } from "@/components/dashboard/account-summary"
import { QuickStatsSnapshot } from "@/components/dashboard/quick-stats-snapshot"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { createClient } from "@/lib/supabase/client"

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickStatsSnapshot />
          <PostPerformanceOverview />
          <div className="space-y-4 lg:col-span-1">
            <ContentCreationShortcuts />
            <CreditUsageTracker />
          </div>
          <AccountSummary />
        </div>
      </Suspense>
    </div>
  )
}