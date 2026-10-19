import { DashboardLayout } from "@/components/dashboard-layout"

export const metadata = { title: "Settings" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
