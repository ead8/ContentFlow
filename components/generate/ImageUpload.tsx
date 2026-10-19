'use client'

import { useRef, useState } from 'react'
import { Coins, Loader2, Maximize2, Sparkles, Trash2, Upload } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

import { ImageUploadStep, WizardFormData } from './MultiStep'
import { generateImage, isInsufficientCredits } from '@/lib/api/client'
import { uploadMedia, IMAGE_TYPES } from '@/lib/media/upload'
import { useToast } from '@/hooks/use-toast'
import FullscreenImageViewer from './fullScreenViewer'
import CreditLockoutModal from '../credit/credit-lookout-modal'
import { CREDIT_COSTS } from '@/lib/billing/plans'
import { useAuth } from '../auth-provider'

interface ImageUploadsProps {
  data?: WizardFormData
  setStepData: (stepData: ImageUploadStep | undefined) => void
  setBusy: (busy: boolean) => void
}

const ImageUpload = ({ data, setStepData, setBusy }: ImageUploadsProps) => {
  const { toast } = useToast()
  const { user, refreshProfile } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)

  const suggestion = Object.values(data?.step_1?.platform_posts || {}).find((p) => p.image_suggestion)?.image_suggestion
  const [prompt, setPrompt] = useState(data?.step_2?.prompt || suggestion || '')
  const [preview, setPreview] = useState<string | null>(data?.step_2?.image_upload || null)
  const [isWorking, setIsWorking] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showLockout, setShowLockout] = useState(false)

  const begin = () => {
    setIsWorking(true)
    setBusy(true)
  }
  const end = () => {
    setIsWorking(false)
    setBusy(false)
  }

  const handleGenerate = async () => {
    const text = prompt.trim()
    if (text.length < 5) {
      toast({ variant: 'destructive', title: 'Describe the image in at least 5 characters.' })
      return
    }
    begin()
    try {
      const url = await generateImage(text.replace(/\n/g, ' '))
      setPreview(url)
      setStepData({ prompt: text, image_source: 'generated', image_upload: url })
      toast({ title: 'Image generated', description: `${CREDIT_COSTS.image} credits used.` })
    } catch (error: any) {
      if (isInsufficientCredits(error)) setShowLockout(true)
      else toast({ variant: 'destructive', title: 'Image generation failed', description: error.message })
    } finally {
      end()
      refreshProfile()
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    begin()
    try {
      const url = await uploadMedia(file, 'image')
      setPreview(url)
      setStepData({ image_source: 'uploaded', image_upload: url })
      toast({ title: 'Image uploaded' })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message })
    } finally {
      end()
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const handleRemove = () => {
    setPreview(null)
    setStepData(undefined)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Add an image to your post. This step is optional. Press Skip to continue without one.
        </p>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-3 pt-2">
            <Label htmlFor="image-prompt">Describe the image</Label>
            <Textarea
              id="image-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A bright flat-lay of fresh vegan dishes on a wooden table"
              className="min-h-[100px] resize-none"
              maxLength={1000}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" />
                Costs {CREDIT_COSTS.image} credits{user ? ` · ${user.credits} available` : ''}
              </p>
              <Button onClick={handleGenerate} disabled={isWorking}>
                {isWorking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working...
                  </>
                ) : (
                  'Generate Image'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 pt-2">
            <Label htmlFor="image-file">Image file (PNG, JPEG, WebP or GIF, up to 10 MB)</Label>
            <input
              id="image-file"
              ref={fileInput}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              disabled={isWorking}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
            />
            {isWorking && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </p>
            )}
          </TabsContent>
        </Tabs>

        {preview && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Selected image</h3>
            <div className="relative w-full max-w-xl overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected post image" className="w-full object-cover" />
              <div className="absolute right-2 top-2 flex gap-2">
                <Button size="icon" variant="secondary" onClick={() => setFullscreen(true)} aria-label="View full screen">
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={handleRemove} aria-label="Remove image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {fullscreen && preview && <FullscreenImageViewer src={preview} onClose={() => setFullscreen(false)} />}
      <CreditLockoutModal
        isOpen={showLockout}
        onClose={() => setShowLockout(false)}
        credits={user?.credits ?? 0}
        cost={CREDIT_COSTS.image}
      />
    </Card>
  )
}

export default ImageUpload
