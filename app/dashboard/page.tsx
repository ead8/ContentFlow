import {
  PostPerformanceOverview,
  ContentCreationShortcuts,
  CreditUsageTracker,
  AccountSummary,
  QuickStatsSnapshot,
} from "@/components/dashboard"

export const metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickStatsSnapshot />
        <PostPerformanceOverview />
        <div className="space-y-4">
          <ContentCreationShortcuts />
          <CreditUsageTracker />
        </div>
        <AccountSummary />
      </div>
    </div>
  )
}
