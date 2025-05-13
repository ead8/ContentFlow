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
import { VideoGenerationStep } from './MultiStep'
import { generateMedia } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'

const videoFormSchema = z.object({
  video_prompt: z.string().min(5, { message: 'Prompt must be at least 5 characters' }),
})

type VideoFormData = z.infer<typeof videoFormSchema>

interface VideoGenerationProps {
  data?: VideoGenerationStep
  setStepData: (stepData: VideoGenerationStep) => void
  setNextStepValid: (isValid: boolean) => void
}

export default function VideoGeneration({
  data,
  setStepData,
  setNextStepValid,
}: VideoGenerationProps) {
  const { toast } = useToast()
  const [videoUrl, setVideoUrl] = useState<string | null>(data?.video_url || null)
  const [isGenerating, setIsGenerating] = useState(false)

  const videoForm = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      video_prompt: data?.video_prompt || '',
    },
  })

  const testVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4' // 🔥 Mock fallback

  const handleGenerate = async (formData: VideoFormData) => {
    try {
      setIsGenerating(true)

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

          {/* Video Preview Box */}
          {(videoUrl || isGenerating) && (
            <div className="pt-4">
              <FormLabel className="block mb-2 text-sm font-medium text-muted-foreground">
                Preview
              </FormLabel>
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
        </Form>
      </CardContent>
    </Card>
  )
}
