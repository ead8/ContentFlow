"use client"

import Link from "next/link"
import { BarChart3, Calendar, FileText, Image as ImageIcon, PencilLine } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ContentCreationShortcuts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full">
          <Link href="/generate">
            <PencilLine className="mr-2 h-4 w-4" />
            Create new post
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href="/posts?status=draft">
              <FileText className="mr-2 h-4 w-4" />
              Drafts
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/calendar">
              <Calendar className="mr-2 h-4 w-4" />
              Calendar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/media">
              <ImageIcon className="mr-2 h-4 w-4" />
              Media
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
