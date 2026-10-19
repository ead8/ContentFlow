import { DashboardLayout } from "@/components/dashboard-layout"

export const metadata = { title: "Plans & Billing" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
