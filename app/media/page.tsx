"use client"

import { useEffect, useState } from "react"
import { Loader2, ImagePlus, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface MediaItem {
  url: string
  postId: string
  postTitle: string | null
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

export default function MediaLibraryPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const posts = await api<any[]>("/api/posts?limit=100")
        const media: MediaItem[] = []
        for (const p of posts || []) {
          for (const url of p.media_urls || []) {
            media.push({ url, postId: p.id, postTitle: p.title || null })
          }
        }
        setItems(media)
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could not load media", description: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  return (
    <main className="mx-auto max-w-6xl py-6 px-4 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <p className="text-sm text-muted-foreground">
          Every image attached to your posts, in one place. Generate more from the Create flow.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <ImagePlus className="w-16 h-16 text-muted-foreground mb-6" />
          <h2 className="text-xl font-bold mb-2">No media yet</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Images you generate or attach to posts will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <Card key={`${item.postId}-${i}`} className="overflow-hidden group">
              <CardContent className="p-0 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.postTitle || "Post media"}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                <a
                  href={`/posts/${item.postId}`}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  title={item.postTitle || "View post"}
                >
                  <ExternalLink className="h-6 w-6 text-white" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
