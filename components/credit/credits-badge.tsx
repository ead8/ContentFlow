"use client"

import { useEffect, useState } from "react"
import { Info, Image as LucideImage, Video } from "lucide-react"
import Image from "next/image"
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

  // const imageRemaining = creditUsage.total_image_credits - creditUsage.image_credits_used;
  // const videoRemaining = creditUsage.total_video_credits - creditUsage.video_credits_used;
  
  // Calculate progress percentages
  const imageProgress = (creditUsage.image_credits_used / creditUsage.total_image_credits) * 100;
  const videoProgress = (creditUsage.video_credits_used / creditUsage.total_video_credits) * 100;

  return (
    <TooltipProvider>
      <Tooltip>        <TooltipTrigger asChild>
          <div className="flex items-center cursor-default">
            <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Image src="/images/icons/credit.svg" alt="Credits" width={36} height={36} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">
                  <LucideImage className="inline-block h-3 w-3 mr-0.5" aria-hidden="true" /> {creditUsage.image_credits_used}/{creditUsage.total_image_credits}
                </span>
                <span className="text-xs text-muted-foreground mx-0.5">|</span>
                <span className="text-sm font-medium">
                  <Video className="inline-block h-3 w-3 mr-0.5" aria-hidden="true" /> {creditUsage.video_credits_used}/{creditUsage.total_video_credits}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Credits available</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-4 bg-gray-900 text-white border-gray-700 rounded-xl  w-[211px] h-[150px] overflow-Y-auto">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white mb-3">You have used</h4>
            
            {/* Video Credits Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-white" aria-hidden="true" />
                  <span className="text-sm font-medium text-white">Videos</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {creditUsage.video_credits_used}/{creditUsage.total_video_credits}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
            </div>

            {/* Image Credits Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LucideImage className="h-4 w-4 text-white" aria-hidden="true" />
                  <span className="text-sm font-medium text-white">Images</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {creditUsage.image_credits_used}/{creditUsage.total_image_credits}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${imageProgress}%` }}
                />
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}