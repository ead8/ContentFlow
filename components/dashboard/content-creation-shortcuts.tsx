"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PencilLine, Image, Video, Copy, Calendar } from "lucide-react"
import Link from "next/link"

export function ContentCreationShortcuts() {
  const templates = [
    {
      id: 1,
      name: "Product Launch",
      platform: "linkedin",
      lastUsed: "2 days ago"
    },
    {
      id: 2,
      name: "Weekly Update",
      platform: "twitter",
      lastUsed: "5 days ago"
    },
    {
      id: 3,
      name: "Behind the Scenes",
      platform: "instagram",
      lastUsed: "1 week ago"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button asChild className="w-full">
          <Link href="/generate">
            <PencilLine className="mr-2 h-4 w-4" />
            Create New Post
          </Link>
        </Button>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Templates</h4>
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-2 rounded-md border hover:bg-accent cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <PencilLine className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {template.platform} • {template.lastUsed}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href="/media">
              <Image className="mr-2 h-4 w-4" />
              Media Library
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/schedule">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}