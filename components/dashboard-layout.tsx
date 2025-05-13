"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  BrainCircuit, 
  Menu, 
  X, 
  PencilLine, 
  Image, 
  Calendar,
  BarChart4,
  Settings,
  LogOut,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { WorkspaceSwitcher } from "./workspace-switcher"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [isMounted, setIsMounted] = useState(false)
  const [workspaces, setWorkspaces] = useState(["Marketing", "Social", "Research"])
  const [currentWorkspace, setCurrentWorkspace] = useState("Marketing")

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  if (!isMounted) {
    return null
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">
      <p>Please login to access this page.</p>
    </div>
  }

  const routes = [
    {
      label: "Generate Content",
      href: "/generate",
      icon: <PencilLine className="h-5 w-5" />,
      active: pathname?.startsWith("/generate"),
    },
    {
      label: "Media Library",
      href: "/media",
      icon: <Image className="h-5 w-5" />,
      active: pathname?.startsWith("/media"),
    },
    {
      label: "Posts",
      href: "/posts",
      icon: <Calendar className="h-5 w-5" />,
      active: pathname?.startsWith("/posts"),
    },
    {
      label: "Analytics",
      href: "/analytics",
      icon: <BarChart4 className="h-5 w-5" />,
      active: pathname?.startsWith("/analytics"),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      active: pathname?.startsWith("/settings"),
    },
  ]

  const initials = user.email
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex items-center gap-2 font-bold text-xl mb-8">
                  <BrainCircuit className="h-6 w-6 text-primary" />
                  <span>Intuity Sync</span>
                </div>
                <nav className="flex flex-col gap-1">
                  {routes.map((route) => (
                    <Link key={route.href} href={route.href}>
                      <Button
                        variant={route.active ? "secondary" : "ghost"}
                        className={cn("w-full justify-start", route.active && "bg-secondary")}
                      >
                        {route.icon}
                        <span className="ml-2">{route.label}</span>
                      </Button>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
              <BrainCircuit className="h-6 w-6 text-primary" />
              {/* <span className="hidden md:inline-block">Intuity Sync</span> */}
               <WorkspaceSwitcher
                current={currentWorkspace}
                options={workspaces}
                onChange={(ws) => setCurrentWorkspace(ws)}
                onAddNew={() => {
                  const newWs = prompt("Enter new workspace name")
                  if (newWs) setWorkspaces((prev) => [...prev, newWs])
                }}
                onSettings={() => alert("Open Workspace Settings")}
                />
            </Link>
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              {routes.map((route) => (
                <Link key={route.href} href={route.href}>
                  <Button
                    variant={route.active ? "secondary" : "ghost"}
                    className={cn(
                      "px-2 lg:px-3", 
                      route.active && "bg-secondary"
                    )}
                  >
                    {route.icon}
                    <span className="ml-2 hidden lg:inline-block">{route.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.role} plan
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer w-full">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}