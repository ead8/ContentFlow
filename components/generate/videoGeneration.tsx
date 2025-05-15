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
import { generateMedia } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'

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

  const videoForm = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      video_prompt: data?.step_3?.video_prompt || '',
    },
  })

  const testVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4' // 🔥 Mock fallback

  const handleGenerate = async (formData: VideoFormData) => {
    try {
      setIsGenerating(true)
      setBackStepValid(false)

      const generatedVideoUrl = await generateMedia({
        prompt: formData.video_prompt,
        media_type: 'video',
      })

      setVideoUrl(generatedVideoUrl)
      setStepData({
        video_prompt: formData.video_prompt,
        video_url: generatedVideoUrl,
      })
      setNextStepValid(true)

      toast({
        title: 'Success! ✨',
        description: 'Your video was generated beautifully.',
      })
    } catch (error: any) {
      // 👇 Set mock fallback
      setVideoUrl(testVideoUrl)
      setStepData({
        video_prompt: formData.video_prompt,
        video_url: testVideoUrl,
      })
      setNextStepValid(true)

      console.error('Error generating video:', error)
      
      toast({
        variant: 'destructive',
        title: 'Oops, generation failed 😓',
        description: 'We’ve shown a mock video instead. Please try again later.',
      })
    } finally {
      setIsGenerating(false)
      setBackStepValid(true)
    }
  }

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
        {(isGenerating || videoUrl) && (
          <div className="pt-4">
            <p className="block mb-2 text-sm font-medium text-muted-foreground">
              Video Preview
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
              {data?.platform?.map((platform, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-2xl aspect-video rounded-xl border border-muted-foreground/10 shadow overflow-hidden bg-muted relative flex flex-col items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-muted-foreground/20 animate-spin border-2 border-muted-foreground/30 border-t-transparent" />
                      <span className="text-sm text-muted-foreground mt-2">
                        Generating video for {platform}...
                      </span>
                    </>
                  ) : videoUrl ? (
                    <video controls src={videoUrl} className="w-full h-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

    </Card>
  )
}
