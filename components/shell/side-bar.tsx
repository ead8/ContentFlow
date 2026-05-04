"use client"
import Link from "next/link"
import { Plus, LayoutDashboard, FileText, Calendar, BarChart3, Settings, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("hidden h-screen w-64 bg-card border-r border-border md:sticky md:top-0 md:flex md:flex-col py-6", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center px-6 mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">ContentFlow</span>
        </Link>
      </div>

      {/* Create Post Button */}
      <div className="px-4 mb-6">
        <Link href={'/generate'}>
          <Button className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10">
            <Plus className="h-4 w-4" />
            Create Post
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          <NavItem 
            href="/dashboard" 
            icon={<LayoutDashboard className="h-4 w-4" />} 
            label="Dashboard" 
          />
          <NavItem 
            href="/posts" 
            icon={<FileText className="h-4 w-4" />} 
            label="My Posts" 
          />
          <NavItem 
            href="/calendar" 
            icon={<Calendar className="h-4 w-4" />} 
            label="Calendar" 
          />
          <NavItem 
            href="/analytics" 
            icon={<BarChart3 className="h-4 w-4" />} 
            label="Analytics" 
          />
        </ul>
      </nav>

      {/* Settings at Bottom */}
      <div className="px-3 pt-6 border-t border-border">
        <NavItem 
          href="/settings" 
          icon={<Settings className="h-4 w-4" />} 
          label="Settings" 
        />
      </div>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors">
        {icon}
        {label}
      </Link>
    </li>
  )
}
