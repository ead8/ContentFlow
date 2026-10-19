'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { VideoGenerationStep, WizardFormData } from './MultiStep'
import { uploadMedia, VIDEO_TYPES } from '@/lib/media/upload'
import { useToast } from '@/hooks/use-toast'

interface VideoStepProps {
  data?: WizardFormData
  setStepData: (stepData: VideoGenerationStep | undefined) => void
  setBusy: (busy: boolean) => void
}

/**
 * Optional video for the post (uploaded by the user). Platforms such as
 * TikTok, Instagram Reels and YouTube Shorts need one.
 */
export default function VideoGeneration({ data, setStepData, setBusy }: VideoStepProps) {
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(data?.step_3?.video_url || null)
  const [isUploading, setIsUploading] = useState(false)

  const videoPlatforms = (data?.platform || []).filter((p) => p === 'Tiktok' || p === 'YouTube_Shorts')
  const suggestion = Object.values(data?.step_1?.platform_posts || {}).find((p) => p.video_suggestion)?.video_suggestion

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setIsUploading(true)
    setBusy(true)
    try {
      const url = await uploadMedia(file, 'video')
      setVideoUrl(url)
      setStepData({ video_url: url })
      toast({ title: 'Video uploaded' })
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message })
    } finally {
      setIsUploading(false)
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Attach a video to your post. This step is optional. Press Skip to continue without one.</p>
          {videoPlatforms.length > 0 && (
            <p className="text-foreground">
              TikTok and YouTube Shorts posts need a video. Upload one here or add it when you publish.
            </p>
          )}
          {suggestion && (
            <p>
              <span className="font-medium text-foreground">Video idea: </span>
              {suggestion}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-file">Video file (MP4, MOV or WebM, up to 50 MB)</Label>
          <input
            id="video-file"
            ref={fileInput}
            type="file"
            accept={VIDEO_TYPES.join(',')}
            disabled={isUploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:bg-primary/90"
          />
          {isUploading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading... large videos can take a minute.
            </p>
          )}
        </div>

        {videoUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Selected video</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVideoUrl(null)
                  setStepData(undefined)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
            <video controls src={videoUrl} className="w-full max-w-2xl rounded-xl border" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
