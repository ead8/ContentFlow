"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { ArrowRight, Info } from "lucide-react"
import { fetchCreditUsage } from "@/lib/n8n/client"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function CreditUsageTracker() {
  const [creditUsage, setCreditUsage] = useState<{
    image_credits_used: number;
    video_credits_used: number;
    total_image_credits: number;
    total_video_credits: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCredits() {
      try {
        const data = await fetchCreditUsage();
        setCreditUsage(data);
      } catch (error) {
        console.error('Failed to load credit usage:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadCredits();
  }, []);

  // Calculate percentages for progress bars
  const imagePercentage = creditUsage 
    ? Math.min(Math.round((creditUsage.image_credits_used / creditUsage.total_image_credits) * 100), 100)
    : 0;
  
  const videoPercentage = creditUsage
    ? Math.min(Math.round((creditUsage.video_credits_used / creditUsage.total_video_credits) * 100), 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center">
          Credit Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : creditUsage ? (
          <>
            {/* Image Credits */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center">
                <div className="flex items-center gap-1">
                  <span>Images</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Credits used for AI image generation</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-muted-foreground font-medium">
                  {creditUsage.image_credits_used} / {creditUsage.total_image_credits}
                </span>
              </div>
              <Progress 
                value={imagePercentage} 
                className={`h-2 ${imagePercentage >= 90 ? 'bg-red-600' : 
                  imagePercentage >= 75 ? 'bg-amber-500' : 'bg-green-600'}`} 
              />
            </div>

            {/* Video Credits */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm items-center">
                <div className="flex items-center gap-1">
                  <span>Videos</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Credits used for AI video generation</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-muted-foreground font-medium">
                  {creditUsage.video_credits_used} / {creditUsage.total_video_credits}
                </span>
              </div>
              <Progress 
                value={videoPercentage} 
                className={`h-2 ${videoPercentage >= 90 ? 'bg-red-600' : 
                  videoPercentage >= 75 ? 'bg-amber-500' : 'bg-green-600'}`} 
              />
            </div>
            
            <Button className="w-full" variant="outline">
              Upgrade Plan
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            Unable to load credit information
          </div>
        )}
      </CardContent>
    </Card>
  )
}
