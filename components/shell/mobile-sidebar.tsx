"use client"

import Link from "next/link"
import Image from "next/image"
import { Calendar, Home, LineChart, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetHeader } from "@/components/ui/sheet"

export function MobileSidebar() {
  return (
    <SheetContent side="left" className="w-64 p-0 bg-[#0e0529]">
      <SheetHeader className="p-4">
        <Link href="/" className="flex items-center">
          <Image src="/images/logo.png" alt="Intuity Sync" width={32} height={32} className="h-8 w-8" />
          <span className="ml-2 text-xl font-bold text-white">intuity sync</span>
        </Link>
      </SheetHeader>

      {/* Create Post Button */}
      <div className="px-4 py-2">
        <Button
          variant="outline"
          className="w-full justify-start border-[#2a2162] bg-transparent text-white hover:bg-[#2a2162] hover:text-white"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Post
        </Button>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4">
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/posts" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 5L5 12L19 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              My Posts
            </Link>
          </li>
          <li>
            <Link href="/calendar" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Calendar className="mr-3 h-5 w-5" />
              Calendar
            </Link>
          </li>
          <li>
            <Link href="/analytics" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <LineChart className="mr-3 h-5 w-5" />
              Analytics
            </Link>
          </li>
          <li>
            <Link href="/settings" className="flex items-center rounded-md px-4 py-2 text-white hover:bg-[#2a2162]">
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Link>
          </li>
        </ul>
      </nav>

      {/* Circuit Background at Bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[-1] h-[300px]"
        style={{
          backgroundImage: `url('/circuit-background.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
        }}
      />
    </SheetContent>
  )
}
