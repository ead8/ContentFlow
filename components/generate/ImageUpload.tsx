'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UploadCloud, Sparkles, Maximize2 } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Textarea } from '../ui/textarea'

import { ImageUploadStep, WizardFormData } from './MultiStep'
import { generateImage, generateMedia } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'
import FullscreenImageViewer from './fullScreenViewer'
import CreditLockoutModal from '../credit/credit-lookout-modal'

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

  // Initialize react-hook-form
  const form = useForm({
    resolver: zodResolver(imageUploadSchema),
    defaultValues: {
      generationPrompt: data?.step_2?.prompt || '',
    },
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setUploadPreview(url)
      setStepData({ image_upload: url, image_source: 'uploaded', file })
      setNextStepValid(true)
    }
  }

  const onSubmit = async (formData: { generationPrompt: string }) => {
    const noCredits = false; // replace with real credit logic
    if(noCredits) {
      setIsShowCreditLockout(true)
      
    } else {
      try {
        setIsGenerating(true)
        setBackStepValid(false)
  
        const generatedImageUrl = await generateImage({
          prompt: formData.generationPrompt
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
      } catch (error: any) {
        console.error('Error generating image:', error)
        toast({
          variant: 'destructive',
          title: 'Generation failed 😢',
          description: error.message || 'There was an error generating your image.',
        })
      } finally {
        setIsGenerating(false)
        setBackStepValid(true)
        setNextStepValid(true)
      }
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-8">
        {/* Upload Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Upload Image
          </h2>

          <label
            htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full max-w-lg p-6 border-2 border-dashed border-muted rounded-xl cursor-pointer transition hover:bg-muted/40"
          >
            <UploadCloud className="w-10 h-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground/60">PNG, JPG, JPEG — up to 5MB</p>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Generator Section */}
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            Or Generate via AI
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
                        placeholder="Describe the image you want to generate with a touch of magic ✨"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
              {data?.platform?.map((platform) => (
                <div
                  key={platform}
                  className="relative rounded-xl overflow-hidden shadow-md border border-muted w-full aspect-[4/3]"
                >
                  {/* Image that fills the card */}
                  <Image
                    src={uploadPreview}
                    alt={`${platform} preview`}
                    fill
                    className="object-cover cursor-pointer"
                    // onClick={() => handleImageClick(uploadPreview)}
                  />

                  {/* Platform label overlay */}
                  <div className="absolute bottom-0 w-full bg-black/40 text-white text-sm font-medium text-center py-1">
                    {platform}
                  </div>
                  <button
                    className="absolute top-2 right-2 bg-black bg-opacity-20 p-1 rounded-full text-black group-hover:opacity-100 transition"
                    onClick={() => setFullscreenSrc(uploadPreview)}
                    title="View fullscreen"
                  >
                    <Maximize2 size={18} />
                  </button>
                </div>
              ))}
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
        usedCredits={260}
        totalCredits={260}
        onUpgradeClick={() => {}}
      />
    </Card>
  )
}

export default ImageUpload