"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { fetchCreditUsage } from "@/lib/n8n/client"

export function CreditUsageTracker() {
  const [credits, setCredits] = useState({
    posts: { used: 0, total: 50, label: "Posts" },
    images: { used: 0, total: 100, label: "Image Generations" },
    videos: { used: 0, total: 10, label: "Video Credits" }
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadCredits() {
      try {
        const data = await fetchCreditUsage()
        setCredits(data)
      } catch (error) {
        console.error('Failed to load credit usage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadCredits()
  }, [])

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