"use client"

import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ACCOUNT_NAV, MAIN_NAV, NavList } from "./nav-items"

export function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
  return (
    <SheetContent side="left" className="flex w-72 flex-col p-0">
      <SheetHeader className="p-4 text-left">
        <SheetTitle asChild>
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold">ContentFlow</span>
          </Link>
        </SheetTitle>
      </SheetHeader>

      <div className="px-4 py-2">
        <SheetClose asChild>
          <Button asChild className="w-full justify-start gap-2">
            <Link href="/generate">
              <Plus className="h-4 w-4" />
              Create Post
            </Link>
          </Button>
        </SheetClose>
      </div>

      <nav className="mt-4 flex-1 px-3" aria-label="Main">
        <NavList items={MAIN_NAV} onNavigate={onNavigate} />
      </nav>
      <nav className="border-t px-3 py-4" aria-label="Account">
        <NavList items={ACCOUNT_NAV} onNavigate={onNavigate} />
      </nav>
    </SheetContent>
  )
}
