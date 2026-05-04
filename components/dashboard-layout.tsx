"use client"

import type React from "react"
import { Sidebar } from "./shell/side-bar"
import { Header } from "./shell/header"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header isSidebarOpen={false} onToggleSidebar={() => {}} />

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background/50 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
