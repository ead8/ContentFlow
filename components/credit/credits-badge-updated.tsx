"use client"

import { useEffect, useState } from "react"
import { Coins, Info, Image, Video } from "lucide-react"
import { fetchCreditUsage } from "@/lib/api/supabase" 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function CreditsBadge() {
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

  if (isLoading) {
    return (
      <div className="flex items-center h-8 px-2 rounded-md bg-gray-100 dark:bg-gray-800">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!creditUsage) {
    return null;
  }

  const imageRemaining = creditUsage.total_image_credits - creditUsage.image_credits_used;
  const videoRemaining = creditUsage.total_video_credits - creditUsage.video_credits_used;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center cursor-default">
            <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Coins className="h-5 w-5 text-blue-500 dark:text-blue-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">
                  <Image className="inline-block h-3 w-3 mr-0.5" aria-hidden="true" /> {creditUsage.image_credits_used}/{creditUsage.total_image_credits}
                </span>
                <span className="text-xs text-muted-foreground mx-0.5">|</span>
                <span className="text-sm font-medium">
                  <Video className="inline-block h-3 w-3 mr-0.5" aria-hidden="true" /> {creditUsage.video_credits_used}/{creditUsage.total_video_credits}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Credits Used</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-2 max-w-xs">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Credit Usage</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Image className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-medium">Image Credits</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium">{creditUsage.image_credits_used}</span> used of {creditUsage.total_image_credits} total
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-medium">Video Credits</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium">{creditUsage.video_credits_used}</span> used of {creditUsage.total_video_credits} total
                </div>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
