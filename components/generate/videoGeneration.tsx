'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, VideoIcon } from 'lucide-react'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from '@/components/ui/form'
import { Card, CardContent } from '../ui'
import { VideoGenerationStep, WizardFormData } from './MultiStep'
import { generateMedia, pollVideoStatus } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'
import CreditLockoutModal from '../credit/credit-lookout-modal'

const videoFormSchema = z.object({
  video_prompt: z.string().min(5, { message: 'Prompt must be at least 5 characters' }),
})

type VideoFormData = z.infer<typeof videoFormSchema>

interface VideoGenerationProps {
  data?: WizardFormData
  setStepData: (stepData: VideoGenerationStep) => void
  setNextStepValid: (isValid: boolean) => void
  setBackStepValid: (isValid: boolean) => void;
}

export default function VideoGeneration({
  data,
  setStepData,
  setNextStepValid,
  setBackStepValid
}: VideoGenerationProps) {
  const { toast } = useToast()
  const [videoUrl, setVideoUrl] = useState<string | null>(data?.step_3?.video_url || null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isShowCreditLockout, setIsShowCreditLockout] = useState(false)
  
  const videoForm = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      video_prompt: data?.step_3?.video_prompt || '',
    },
  })

  const handleGenerate = async (formData: VideoFormData) => {
  const noCredits = false; // replace with real credit logic
  if (noCredits) {
    setIsShowCreditLockout(true);
    return;
  }

  try {
    setIsGenerating(true);
    setBackStepValid(false);

    /* 1️⃣ request generation */
    const result = await generateMedia({
      prompt: formData.video_prompt,
      media_type: "video"
    });

    toast({
      title: "Video queued ⏳",
      description: "We’re processing your video. This usually takes a minute.",
    });

    /* 2️⃣ poll until ready */
    const finalUrl = await pollVideoStatus(result.jobId, result.mediaId);

    setVideoUrl(finalUrl);
    setStepData({
      video_prompt: formData.video_prompt,
      video_url: finalUrl
    });

    setNextStepValid(true);

    toast({
      title: "Success! ✨",
      description: "Your video is ready.",
    });

  } catch (err: any) {
    console.error("Video Pulling Error",err);

    toast({
      variant: "destructive",
      title: "Oops! The video didn’t make it",
      description: "Video is taking longer than expected. Please try again in a few minutes.",
    });

  } finally {
    setIsGenerating(false);
    setBackStepValid(true);
    setNextStepValid(true);
  }
};

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <VideoIcon className="w-5 h-5 text-primary" />
          Video Generation
        </h2>

        <Form {...videoForm}>
          <form
            onSubmit={videoForm.handleSubmit(handleGenerate)}
            className="space-y-6 flex flex-col"
          >
            <FormField
              control={videoForm.control}
              name="video_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us what your video should look like… 🎥"
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isGenerating}
              className="self-end transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Video'
              )}
            </Button>
          </form>
        </Form>
        {/* Video Preview Box */}
        {(videoUrl || isGenerating) && (
          <div className="pt-4">
            <p className="block mb-2 text-sm font-medium text-muted-foreground">
              Preview
            </p>
            <div className="w-full max-w-2xl aspect-video rounded-xl border border-muted-foreground/10 shadow-lg overflow-hidden bg-muted relative">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center gap-3 w-full h-full animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted-foreground/20 animate-spin border-2 border-muted-foreground/30 border-t-transparent" />
                  <span className="text-sm text-muted-foreground">
                    Generating your video...
                  </span>
                </div>
              ) : (
                <video
                  controls
                  src={videoUrl ?? undefined}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CreditLockoutModal
        isOpen={isShowCreditLockout}
        onClose={() => {setIsShowCreditLockout(false)}}
        usedCredits={260}
        totalCredits={260}
        onUpgradeClick={() => {}}
      />
    </Card>
  )
}
