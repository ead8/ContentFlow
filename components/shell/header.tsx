"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CreditCard, LogOut, Menu, Search, Settings, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { MobileSidebar } from "./mobile-sidebar"
import { useAuth } from "../auth-provider"
import { CreditsBadge } from "../credit/credits-badge"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { getPlan } from "@/lib/billing/plans"

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/posts?q=${encodeURIComponent(q)}` : "/posts")
  }

  const initial = (user?.fullName || user?.email || "U").charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex flex-1 items-center gap-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <MobileSidebar onNavigate={() => setMenuOpen(false)} />
        </Sheet>

        <form onSubmit={onSearch} role="search" className="relative hidden w-full max-w-md sm:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your posts..."
            aria-label="Search your posts"
            className="h-9 w-full rounded-lg border-0 bg-muted pl-9 focus-visible:ring-1 focus-visible:ring-accent"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        <CreditsBadge />
        {user?.plan === "free" && (
          <Button asChild size="sm" className="hidden sm:flex">
            <Link href="/billing">Upgrade</Link>
          </Button>
        )}

        <NotificationBell />
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initial}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="flex flex-col gap-0.5 border-b border-border p-3">
              <p className="truncate text-sm font-medium">{user?.fullName || user?.email}</p>
              {user?.fullName && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              <p className="text-xs text-muted-foreground">{getPlan(user?.plan).name} plan</p>
            </div>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex cursor-pointer items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="flex cursor-pointer items-center gap-2">
                <CreditCard className="h-4 w-4" /> Plans & Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex cursor-pointer items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
