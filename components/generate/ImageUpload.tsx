'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles, Maximize2, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Textarea } from '../ui/textarea'

import { ImageUploadStep, WizardFormData } from './MultiStep'
import { generateImage } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'
import FullscreenImageViewer from './fullScreenViewer'
import CreditLockoutModal from '../credit/credit-lookout-modal'
import { CreditUsage } from '@/models/user'
import { fetchCreditUsage } from '@/lib/api/supabase'
import NotifyCreditWarning, { NotifyCreditWarningRef } from '../credit/credit-usage-warning'
import FeedbackModal from '../feedback/feedback-modal'

const imageUploadSchema = z.object({
  generationPrompt: z
    .string()
    .min(5, { message: 'Prompt must be at least 5 characters.' }),
})

interface ImageUploadsProps {
  data?: WizardFormData
  setStepData: (stepData: ImageUploadStep) => void
  setNextStepValid: (isValid: boolean) => void
  setBackStepValid: (isValid: boolean) => void;
}

const ImageUpload = ({ data, setStepData, setNextStepValid, setBackStepValid }: ImageUploadsProps) => {
  const { toast } = useToast()
  const [uploadPreview, setUploadPreview] = useState<string | null>(data?.step_2?.image_upload || null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  const [isShowCreditLockout, setIsShowCreditLockout] = useState(false)
  const [creditUsage, setCreditUsage] = useState<CreditUsage | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [openFeedbackModal, setOpenFeedbackModal] = useState(false)

  const imageCreditRef = useRef<NotifyCreditWarningRef>(null);

  // Initialize react-hook-form
  const form = useForm({
    resolver: zodResolver(imageUploadSchema),
    defaultValues: {
      generationPrompt: data?.step_2?.prompt || '',
    },
  })

  const onSubmit = async (formData: { generationPrompt: string }) => {
    if(creditUsage && creditUsage.total_image_credits - creditUsage.image_credits_used <= 0) {
      setIsShowCreditLockout(true)
    } else {
      try {
        setIsGenerating(true)
        setBackStepValid(false)
  
        const generatedImageUrl = await generateImage({
          prompt: formData.generationPrompt.replace(/\n/g, ' ')
        })
  
        setUploadPreview(generatedImageUrl)
        setStepData({
          prompt: formData.generationPrompt,
          image_source: 'generated',
          image_upload: generatedImageUrl,
        })
  
        toast({
          title: '✨ Image generated!',
          description: 'Your image was successfully created with AI magic.',
        })

        loadCreditUsage()
        imageCreditRef.current?.checkCredits()
      } catch (error: any) {
        console.error('Error generating image:', error)
        setOpenFeedbackModal(true)
      } finally {
        setIsGenerating(false)
        setBackStepValid(true)
        setNextStepValid(true)
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
          <span className="text-sm font-medium">Image Credits</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoadingCredits ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : creditUsage ? (
            <span className="text-sm font-bold">
              {creditUsage.total_image_credits - creditUsage.image_credits_used}{" "}
              <span className="text-muted-foreground font-normal">/ {creditUsage.total_image_credits} remaining</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground flex items-center gap-2"><RefreshCcw className='w-4 h-4 cursor-pointer text-primary' onClick={() => loadCreditUsage()}/>Unable to load credits</span>
          )}
        </div>
      </div>
      <CardContent className="pt-6 space-y-8">

        {/* Generator Section */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            Image Generation
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col">
              <FormField
                control={form.control}
                name="generationPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe the image you want to generate"
                        className="min-h-[100px] resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isGenerating} className="self-end">
                {isGenerating ? 'Generating...' : 'Generate Image'}
              </Button>
            </form>
          </Form>
        </div>

        {/* Preview Section */}
        {uploadPreview && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-muted-foreground">Image Previews</h3>
              <div
                className="relative rounded-xl overflow-hidden shadow-md border border-muted w-full aspect-[4/3]"
              >
                {/* Image that fills the card */}
                <Image
                  src={uploadPreview}
                  alt={`Image preview`}
                  fill
                  className="object-cover cursor-pointer"
                />

                <button
                  className="absolute top-2 right-2 bg-white p-1 rounded-full text-black group-hover:opacity-100 transition"
                  onClick={() => setFullscreenSrc(uploadPreview)}
                  title="View fullscreen"
                >
                  <Maximize2 size={18} />
                </button>
              </div>
          </div>
        )}

        </CardContent>
        {fullscreenSrc && (
          <FullscreenImageViewer src={fullscreenSrc} onClose={() => setFullscreenSrc(null)} />
        )}

      <CreditLockoutModal
        isOpen={isShowCreditLockout}
        onClose={() => {setIsShowCreditLockout(false)}}
        usedCredits={creditUsage?.image_credits_used ?? 0}
        totalCredits={creditUsage?.total_image_credits ?? 0}
        onUpgradeClick={() => {}}
      />
      <NotifyCreditWarning ref={imageCreditRef} type="image" />
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

export default ImageUpload