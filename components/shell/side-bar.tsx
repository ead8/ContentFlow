"use client"

import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ACCOUNT_NAV, MAIN_NAV, NavList } from "./nav-items"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden h-screen w-64 shrink-0 border-r border-border bg-card py-6 md:sticky md:top-0 md:flex md:flex-col",
        className
      )}
    >
      <div className="mb-6 flex h-12 items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">ContentFlow</span>
        </Link>
      </div>

      <div className="mb-6 px-4">
        <Button asChild className="h-10 w-full justify-start gap-2">
          <Link href="/generate">
            <Plus className="h-4 w-4" />
            Create Post
          </Link>
        </Button>
      </div>

      <nav className="flex-1 px-3" aria-label="Main">
        <NavList items={MAIN_NAV} />
      </nav>

      <nav className="border-t border-border px-3 pt-4" aria-label="Account">
        <NavList items={ACCOUNT_NAV} />
      </nav>
    </aside>
  )
}
