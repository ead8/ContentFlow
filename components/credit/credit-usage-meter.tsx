"use client"

import { useState } from "react"
import { Coins, AlertCircle, TrendingUp, Clock, Info } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

// Types for credit usage data
interface CreditUsageData {
  used: number
  total: number
  refreshDate: string // ISO date string
  usageHistory?: {
    date: string // ISO date string
    amount: number
  }[]
}

// Props for the credit usage meter component
interface CreditUsageMeterProps {
  data: CreditUsageData
  variant: "dashboard" | "wizard"
  onPurchase?: () => void
  estimatedUsage?: number // For wizard variant - how many credits the current operation will use
  showHistory?: boolean
}

export function CreditUsageMeter({
  data,
  variant,
  onPurchase,
  estimatedUsage = 0,
  showHistory = false,
}: CreditUsageMeterProps) {
  const [showDetails, setShowDetails] = useState(false)

  // Calculate usage percentage
  const usagePercentage = Math.min(Math.round((data.used / data.total) * 100), 100)

  // Calculate remaining credits
  const remainingCredits = Math.max(data.total - data.used, 0)

  // Format refresh date
  const refreshDate = new Date(data.refreshDate)
  const formattedRefreshDate = refreshDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  // Determine status based on usage
  const getStatus = () => {
    if (usagePercentage >= 90) return "critical"
    if (usagePercentage >= 75) return "warning"
    return "good"
  }

  const status = getStatus()

  

  // Color mapping based on status
  const statusColors = {
    good: {
      progress: "bg-green-600",
      text: "text-green-700",
      background: "bg-green-50",
      border: "border-green-200",
    },
    warning: {
      progress: "bg-amber-500",
      text: "text-amber-700",
      background: "bg-amber-50",
      border: "border-amber-200",
    },
    critical: {
      progress: "bg-red-600",
      text: "text-red-700",
      background: "bg-red-50",
      border: "border-red-200",
    },
  }

  // Check if credits will be exceeded after estimated usage
  const willExceedCredits = variant === "wizard" && data.used + estimatedUsage > data.total

  // Dashboard compact variant
  if (variant === "dashboard") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Coins className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="text-lg">Credit Usage</CardTitle>
            </div>
            {status === "critical" && (
              <Badge variant="destructive" className="ml-2">
                Low Credits
              </Badge>
            )}
            {status === "warning" && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                Running Low
              </Badge>
            )}
          </div>
          <CardDescription>{usagePercentage}% of your credits used</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="space-y-4">
            <Progress value={usagePercentage} className={`h-2 ${statusColors[status].progress}`} />

            <div className="flex justify-between items-center text-sm">
              <div>
                <span className="font-medium">{data.used.toLocaleString()}</span>
                <span className="text-gray-500"> / {data.total.toLocaleString()} credits used</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center cursor-help">
                      <Clock className="h-3.5 w-3.5 mr-1 text-gray-500" />
                      <span className="text-gray-500">Refreshes {formattedRefreshDate}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your credits will refresh on this date</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <div className="flex justify-between w-full">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide Details" : "View Details"}
            </Button>
            <Button size="sm" onClick={onPurchase}>
              Purchase Credits
            </Button>
          </div>
        </CardFooter>

        {showDetails && showHistory && data.usageHistory && (
          <div className="px-6 pb-4">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              Recent Usage
            </h4>
            <div className="space-y-2 text-sm">
              {data.usageHistory.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-600">
                    {new Date(item.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-medium">{item.amount} credits</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    )
  }

  // Wizard variant
  return (
    <div className={`rounded-lg border p-4 ${statusColors[status].border} ${statusColors[status].background}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div className="flex items-center">
          <Coins className={`h-5 w-5 mr-2 ${statusColors[status].text}`} />
          <h3 className="font-medium">Credit Usage for This Operation</h3>
        </div>

        {willExceedCredits && (
          <div className="flex items-center text-red-600 text-sm">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>You don&apos;t have enough credits</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Progress value={usagePercentage} className={`h-2 ${statusColors[status].progress}`} />

        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <div className="flex items-center text-sm">
            <span className="font-medium">{data.used.toLocaleString()}</span>
            <span className="text-gray-600"> / {data.total.toLocaleString()} credits used</span>

            {estimatedUsage > 0 && (
              <div className="ml-2 flex items-center">
                <span className="text-gray-600">+</span>
                <Badge variant="outline" className="ml-1 font-normal">
                  {estimatedUsage} credits for this task
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center text-sm">
            <span className="text-gray-600 mr-1">Refreshes on</span>
            <span className="font-medium">{formattedRefreshDate}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 ml-1 text-gray-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Your credits will refresh on this date</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {willExceedCredits && (
        <div className="mt-3 flex justify-end">
          <Button onClick={onPurchase} size="sm">
            Purchase More Credits
          </Button>
        </div>
      )}
    </div>
  )
}