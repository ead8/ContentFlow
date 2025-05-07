"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CreditUsageTracker() {
  const credits = {
    posts: {
      used: 24,
      total: 50,
      label: "Posts"
    },
    images: {
      used: 85,
      total: 100,
      label: "Image Generations"
    },
    videos: {
      used: 3,
      total: 10,
      label: "Video Credits"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(credits).map(([key, data]) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{data.label}</span>
              <span className="text-muted-foreground">
                {data.used} / {data.total}
              </span>
            </div>
            <Progress value={(data.used / data.total) * 100} />
          </div>
        ))}
        
        <Button className="w-full" variant="outline">
          Upgrade Plan
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}