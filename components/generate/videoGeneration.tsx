'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { VideoIcon } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, Form } from '@/components/ui/form'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '../ui'
import { VideoGenerationStep } from './MultiStep'

// Define Zod schema for video data
const videoFormSchema = z.object({
  video_type: z.enum(['Shotstack', 'Tavus']),
  video_prompt: z.string().min(5, { message: 'Prompt must be at least 5 characters' }),
  video_url: z.string().url().optional(),
})

type VideoFormData = z.infer<typeof videoFormSchema>

interface VideoGenerationProps {
    data?: VideoGenerationStep
    setStepData: (stepData: VideoGenerationStep) => void;
    setNextStepValid: (isValid: boolean) => void;
}

export default function VideoGeneration({data, setStepData, setNextStepValid}: VideoGenerationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(data?.video_url || null) 

  const videoForm = useForm<z.infer<typeof videoFormSchema>>({
        resolver: zodResolver(videoFormSchema),
        defaultValues: {
        video_type: data?.video_type || 'Shotstack',
        video_prompt: data?.video_prompt || '',
        video_url: data?.video_url || '',  
        },
  })

  // Handle video generation
  const handleGenerate = async (data: VideoFormData) => {
    if (!data.video_prompt || !data.video_type) return
    setIsLoading(true)

    // Simulate API call to generate video
    setTimeout(() => {
      const url =
        data.video_type === 'Shotstack'
          ? 'https://cdn.example.com/shotstack-video.mp4'
          : 'https://cdn.example.com/tavus-video.mp4'

      setVideoUrl(url)
      setIsLoading(false)
      setNextStepValid(true)
    }, 2000)
  }

  useEffect(() => {
    setNextStepValid(true)
  }, [])

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
            <VideoIcon className="w-5 h-5 text-primary" />
            Video Generation
        </h2>
        <Form {...videoForm}>
            <form onSubmit={videoForm.handleSubmit(handleGenerate)} className="space-y-6">
                {/* Video Type Radio Buttons */}
                <FormField
                control={videoForm.control}
                name="video_type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Select Video Type</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                        >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Shotstack" id="shotstack" />
                            <FormLabel htmlFor="shotstack">Shotstack</FormLabel>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Tavus" id="tavus" />
                            <FormLabel htmlFor="tavus">Tavus</FormLabel>
                        </div>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Video Prompt Textarea */}
                <FormField
                control={videoForm.control}
                name="video_prompt"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Video Prompt</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="Describe your video content..."
                        className="min-h-[120px]"
                        {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Submit Button */}
                <Button
                type="submit"
                disabled={isLoading}
                >
                {isLoading ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Video...
                    </>
                ) : (
                    'Generate Video'
                )}
                </Button>
            </form>
            {/* Video Preview */}
            {videoUrl && (
                <div className="pt-4">
                <FormLabel className="block mb-2">Preview</FormLabel>
                <video
                    controls
                    src={videoUrl}
                    className="w-full max-w-lg rounded-lg border shadow-sm"
                />
                </div>
            )}
        </Form>
      </CardContent>
    </Card>
  )
}
