"use client"

import Link from "next/link"
import { LogOut, Menu, Search, Settings, User } from "lucide-react"
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

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ isSidebarOpen, onToggleSidebar }: HeaderProps) {
    const { user, signOut} = useAuth()
  // Placeholder user data - replace with your actual user data
  

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile hamburger with Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <MobileSidebar />
        </Sheet>

        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search posts, analytics..."
            className="w-full bg-muted pl-9 h-9 rounded-lg border-0 focus-visible:ring-1 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CreditsBadge />
        <Button asChild size="sm" className="hidden sm:flex gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/settings#billing">Upgrade</Link>
        </Button>
        
        <NotificationBell />

        <div className="flex items-center gap-1">
          <ModeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" aria-label="Account menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-3 p-3 border-b border-border">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1 leading-tight">
                  <p className="font-medium text-sm text-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role} plan</p>
                </div>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive flex items-center gap-2"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
