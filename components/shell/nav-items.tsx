"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "My Posts", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
]

export const ACCOUNT_NAV = [
  { href: "/billing", label: "Plans & Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function NavList({
  items,
  onNavigate,
}: {
  items: typeof MAIN_NAV
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <ul className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
