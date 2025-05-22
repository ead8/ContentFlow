"use client"

import { Suspense, useEffect } from "react"
import {
  PostPerformanceOverview,
  ContentCreationShortcuts,
  CreditUsageTracker,
  AccountSummary,
  QuickStatsSnapshot
} from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import CreditLockoutModal from "@/components/credit/credit-lookout-modal"
import { CreditUsageMeter } from "@/components/credit/credit-usage-meter"
import { useAdmin } from "@/hooks/useAdmin"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const isAdmin = useAdmin()
  const router = useRouter()

  useEffect(() => {
    if (!isAdmin) {
      router.push('/generate')
    }
  }, [isAdmin, router])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need administrator privileges to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      

      {/* <CreditUsageMeter
        data={{
          used: 30,
          total: 50,
          refreshDate: new Date().toISOString(), // ISO date string
          usageHistory: [
            {
              date: new Date().toISOString(), // ISO date string
              amount: 10
           }
        ]
        }}
        variant={"dashboard"}
        estimatedUsage={30}
        onPurchase={() => {}}
        showHistory={true}
      /> */}

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