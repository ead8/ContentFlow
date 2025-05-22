"use client"
import Link from "next/link"
import Image from "next/image"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div className={cn("hidden h-screen w-64 bg-[#0e0529] md:sticky md:top-0 md:block py-2", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center flex items-center justify-center">
        <Link href="/" className="flex items-center relative">
          <Image src="/images/logo/intuitySync_logo.svg" alt="Intuity Sync" width={32} height={32} className="h-28 w-28" />
        </Link>
      </div>

      {/* Create Post Button */}
      <div className="px-4 py-2">
        <Link href={'/generate'}>
          <Button
            variant="outline"
            className="w-full justify-center border-[#2a2162] bg-transparent text-white hover:bg-[#2a2162] hover:text-white"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Post
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4">
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Image
                src="/images/icons/house-alt.svg"
                alt="Dashboard"
                width={20}
                height={20}
                className="mr-3 h-5 w-5"
              />
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/posts" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Image src="/images/icons/add-anchor-point.svg" alt="My Posts" width={20} height={20} className="mr-3 h-5 w-5" />
              My Posts
            </Link>
          </li>
          <li>
            <Link href="/calendar" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Image src="/images/icons/calender-alt.svg" alt="Calendar" width={20} height={20} className="mr-3 h-5 w-5" />
              Calendar
            </Link>
          </li>
          <li>
            <Link href="/analytics" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Image
                src="/images/icons/graph-alt.svg"
                alt="Analytics"
                width={20}
                height={20}
                className="mr-3 h-5 w-5"
              />
              Analytics
            </Link>
          </li>
          <li>
            <Link href="/settings" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Image src="/images/icons/time-settings.svg" alt="Settings" width={20} height={20} className="mr-3 h-5 w-5" />
              Settings
            </Link>
          </li>
        </ul>
      </nav>

      {/* Circuit Background at Bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[-1] h-[200px] opacity-25"
        style={{
          backgroundImage: `url('/images/background/sidebar_background.svg')`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
        }}
      />
    </div>
  )
}
