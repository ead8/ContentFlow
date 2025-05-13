'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UploadCloud, Sparkles } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Textarea } from '../ui/textarea'

import { ImageUploadStep } from './MultiStep'
import { generateMedia } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

const imageUploadSchema = z.object({
  generationPrompt: z
    .string()
    .min(5, { message: 'Prompt must be at least 5 characters.' }),
})

interface ImageUploadsProps {
  data?: ImageUploadStep
  setStepData: (stepData: ImageUploadStep) => void
  setNextStepValid: (isValid: boolean) => void
}

const ImageUpload = ({ data, setStepData, setNextStepValid }: ImageUploadsProps) => {
  const { toast } = useToast()
  const [uploadPreview, setUploadPreview] = useState<string | null>(data?.image_upload || null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize react-hook-form
  const form = useForm({
    resolver: zodResolver(imageUploadSchema),
    defaultValues: {
      generationPrompt: data?.prompt || '',
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
    try {
      setIsGenerating(true)
      const generatedImageUrl = await generateMedia({
        prompt: formData.generationPrompt,
        media_type: 'image',
      })

      setUploadPreview(generatedImageUrl)
      setStepData({
        prompt: formData.generationPrompt,
        image_source: 'generated',
        image_upload: generatedImageUrl,
      })
      setNextStepValid(true)

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
          <div>
            <h3 className="text-lg font-medium mb-2 text-muted-foreground">Preview</h3>
            <div className="rounded-xl overflow-hidden w-full max-w-lg border border-muted shadow-md">
              <Image
                src={uploadPreview}
                alt="Uploaded or generated preview"
                width={800}
                height={500}
                className="object-cover w-full h-auto transition-all"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ImageUpload