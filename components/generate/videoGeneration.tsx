'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, RefreshCcw, Sparkles, VideoIcon } from 'lucide-react'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
  FormDescription,
} from '@/components/ui/form'
import { Card, CardContent, RadioGroup, RadioGroupItem } from '../ui'
import { VideoGenerationStep, WizardFormData } from './MultiStep'
import { generateMedia, pollVideoStatus } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'
import CreditLockoutModal from '../credit/credit-lookout-modal'
import { CreditUsage } from '@/models/user'
import { fetchCreditUsage } from '@/lib/api/supabase'
import NotifyCreditWarning, { NotifyCreditWarningRef } from '../credit/credit-usage-warning'
import FeedbackModal from '../feedback/feedback-modal'

const videoFormSchema = z.object({
  video_prompt: z.string().min(5, { message: 'Prompt must be at least 5 characters' }),
  delivery_type: z.enum(['instant', 'email']),
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
  const [creditUsage, setCreditUsage] = useState<CreditUsage | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [openFeedbackModal, setOpenFeedbackModal] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  const videoCreditRef = useRef<NotifyCreditWarningRef>(null)
  
  const videoForm = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      video_prompt: data?.step_3?.video_prompt || '',
      delivery_type: 'instant'
    },
  })

  const deliveryType = useWatch({
    control: videoForm.control,
    name: "delivery_type",
  })

  const handleOnSubmit = async (formData: VideoFormData) => {
    if(formData.delivery_type === "email") {
      handleGenerateWithEmail(formData)
    } else {
      handleGenerate(formData)
    }
  }

  const handleGenerate = async (formData: VideoFormData) => {
    if(creditUsage && creditUsage.total_video_credits - creditUsage.video_credits_used <= 0) {
      setIsShowCreditLockout(true);
      return;
    } else {
      try {
        setIsWaiting(true)
        setIsGenerating(true);
        setBackStepValid(false);
    
        /* 1️⃣ request generation */
        const result = await generateMedia({
          prompt: formData.video_prompt.replace(/\n/g, ' '),
          media_type: "video",
          cron_job: false
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
    
        // Fetch updated credit usage after generation
        loadCreditUsage()
        videoCreditRef.current?.checkCredits()
    
      } catch (err: any) {
        console.error("Video Pulling Error",err);
        setOpenFeedbackModal(true);
    
      } finally {
        setIsGenerating(false);
        setBackStepValid(true);
        setNextStepValid(true);
      }
    }
  };

  const handleGenerateWithEmail = async (formData: VideoFormData) => {
    if(creditUsage && creditUsage.total_video_credits - creditUsage.video_credits_used <= 0) {
      setIsShowCreditLockout(true);
      return;
    } else {
      try {
        setIsWaiting(false)
        setIsGenerating(true);
        setBackStepValid(false);
    
        /* 1️⃣ request generation */
        const result = await generateMedia({
          prompt: formData.video_prompt.replace(/\n/g, ' '),
          media_type: "video",
          cron_job: true
        });
    
        setStepData({
          video_prompt: formData.video_prompt,
          job_id: result.jobId,
          media_id: result.mediaId,
          isEmailNotify: true
        });
    
        setNextStepValid(true);
    
        toast({
          title: "Video Request Received 📩",
          description: "We’re generating your video. You’ll receive an email once it’s ready.",
        })
    
      } catch (err: any) {
        console.error("Video Generation Error",err);
        setOpenFeedbackModal(true);
    
      } finally {
        setIsGenerating(false);
        setBackStepValid(true);
        setNextStepValid(true);
      }
    }
  }

  const loadCreditUsage = async () => {
      try {
        setIsLoadingCredits(true)
        const usage = await fetchCreditUsage()
        setCreditUsage(usage)
      } catch (error) {
        console.error("Failed to load credit usage:", error)
      } finally {
        setIsLoadingCredits(false)
      }
  }

  useEffect(() => {
    loadCreditUsage()
  }, [])

  return (
    <Card>
      {/* Credit Balance Display */}
      <div className="flex justify-between items-center bg-muted/30 p-3 rounded-t-l-lg rounded-t-r-lg border border-muted">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium">Video Credits</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoadingCredits ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : creditUsage ? (
            <span className="text-sm font-bold">
              {creditUsage.total_video_credits - creditUsage.video_credits_used}{" "}
              <span className="text-muted-foreground font-normal">/ {creditUsage.total_video_credits} remaining</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground flex items-center gap-2"><RefreshCcw className='w-4 h-4 cursor-pointer text-primary' onClick={() => loadCreditUsage()}/>Unable to load credits</span>
          )}
        </div>
      </div>
      <CardContent className="pt-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <VideoIcon className="w-5 h-5 text-primary" />
          Video Generation
        </h2>

        <Form {...videoForm}>
          <form
            onSubmit={videoForm.handleSubmit(handleOnSubmit)}
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
            {/* Delivery Type Selector */}
            <FormField
              control={videoForm.control}
              name="delivery_type"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Choose how you&apos;d like to receive your video</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="pt-2 flex gap-4"
                      >
                        <FormItem>
                          <div className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value="instant" />
                            </FormControl>
                            <FormLabel className="font-normal">I&apos;ll wait here while the video is being generated</FormLabel>
                          </div>
                        </FormItem>
                        <FormItem>
                          <div className="flex items-center space-x-2">
                            <FormControl>
                              <RadioGroupItem value="email" />
                            </FormControl>
                            <FormLabel className="font-normal">Notify me via email when it&apos;s ready</FormLabel>
                          </div>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    {deliveryType === "instant" && (
                      <p className="text-sm text-muted-foreground pt-4">
                        Stay on this page while we generate your video. It may take a few minutes to generate
                      </p>
                    )}
                    {deliveryType === "email" && (
                      <p className="text-sm text-muted-foreground pt-4">
                        We&apos;ll generate your video in the background and notify you by email once it&apos;s ready.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )
              }
              }
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
        {isWaiting && (videoUrl || isGenerating) && (
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
        usedCredits={creditUsage?.video_credits_used ?? 0}
        totalCredits={creditUsage?.total_video_credits ?? 0}
        onUpgradeClick={() => {}}
      />
      <NotifyCreditWarning
        type='video'
        ref={videoCreditRef}
      />
      {
        openFeedbackModal && (
          <FeedbackModal
          open={openFeedbackModal}
          onClose={() => setOpenFeedbackModal(false)}
          source='error_feedback'
          />
        )
      }
    </Card>
  )
}