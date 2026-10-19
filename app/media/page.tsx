"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, Loader2, Trash2, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { IMAGE_TYPES, VIDEO_TYPES, uploadMedia } from "@/lib/media/upload"

interface MediaItem {
  path: string
  url: string
  name: string
  isVideo: boolean
  createdAt: string
}

const FOLDERS = ["uploads", "generated"]

export default function MediaLibraryPage() {
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You are signed out.")

      const all: MediaItem[] = []
      for (const folder of FOLDERS) {
        const prefix = `${user.id}/${folder}`
        const { data, error } = await supabase.storage
          .from("media")
          .list(prefix, { limit: 500, sortBy: { column: "created_at", order: "desc" } })
        if (error) throw error
        for (const f of data || []) {
          if (!f.id) continue
          const path = `${prefix}/${f.name}`
          all.push({
            path,
            name: f.name,
            url: supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
            isVideo: /\.(mp4|mov|webm)$/i.test(f.name),
            createdAt: f.created_at ?? "",
          })
        }
      }
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setItems(all)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not load media", description: e.message })
      setItems([])
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      await uploadMedia(file, VIDEO_TYPES.includes(file.type) ? "video" : "image")
      toast({ title: "Uploaded" })
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm("Delete this file? Posts that use it will show a broken image.")) return
    setBusyPath(item.path)
    try {
      const { error } = await createClient().storage.from("media").remove([item.path])
      if (error) throw error
      setItems((prev) => prev?.filter((i) => i.path !== item.path) ?? null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message })
    } finally {
      setBusyPath(null)
    }
  }

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => undefined)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">Images and videos you&apos;ve uploaded or generated.</p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
            aria-label="Upload media"
          />
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </Button>
        </div>
      </div>

      {items === null ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No media yet. Upload a file or generate an image while creating a post.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.path} className="overflow-hidden">
              {item.isVideo ? (
                <video src={item.url} className="aspect-square w-full bg-black object-cover" controls preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.name} loading="lazy" className="aspect-square w-full object-cover" />
              )}
              <CardContent className="flex items-center justify-between gap-2 p-2">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.url)}>
                  {copied === item.url ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  {copied === item.url ? "Copied" : "Link"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item)}
                  disabled={busyPath === item.path}
                  aria-label="Delete file"
                >
                  {busyPath === item.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
