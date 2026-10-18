"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { ContentPost } from "@/lib/services/content-posts"

interface PostTarget {
  id: string
  platform: string
  status: string
  published_at: string | null
  error_message: string | null
}

interface PostDetailData extends ContentPost {
  targets: PostTarget[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800">
          Draft
        </Badge>
      )
    case "published":
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800">
          Published
        </Badge>
      )
    case "scheduled":
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          Scheduled
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const PostDetail = ({ postId }: { postId: string }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [post, setPost] = useState<PostDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        const data = await api<PostDetailData>(`/api/posts/${encodeURIComponent(postId)}`)
        setPost(data)
        setEditTitle(data.title || "")
        setEditContent(data.content)
        if (searchParams.get("edit") === "1") setIsEditing(true)
      } catch (error: any) {
        setLoadError(error.message || "Failed to load post.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const handleSave = async () => {
    if (!post) return
    try {
      setIsSaving(true)
      const updated = await api<ContentPost>("/api/posts", {
        method: "PUT",
        body: JSON.stringify({ postId: post.id, title: editTitle, content: editContent }),
      })
      setPost({ ...post, ...updated })
      setIsEditing(false)
      toast({ title: "Post updated" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Could not save changes.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBack = () => {
    router.push("/posts")
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (loadError || !post) {
    return (
      <div className="w-full max-w-7xl mx-auto">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Posts
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600 mb-4">{loadError || "Post not found."}</p>
            <Button variant="outline" onClick={handleBack}>
              Back to Posts
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center min-w-0">
          <Button variant="ghost" onClick={handleBack} className="mr-2 shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Posts
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <h1 className="text-2xl font-bold truncate">
            {post.title || post.content.slice(0, 50)}
          </h1>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          {getStatusBadge(post.status)}
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit Post</Button>
          )}
        </div>
      </div>

      {/* Post metadata card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Post Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Status</div>
              <div>{getStatusBadge(post.status)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Created At</div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                {format(new Date(post.created_at), "MMMM d, yyyy")}
                <Clock className="h-4 w-4 ml-3 mr-1 text-gray-500" />
                {format(new Date(post.created_at), "h:mm a")}
              </div>
            </div>
            {post.scheduled_for && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Scheduled For</div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                  {format(new Date(post.scheduled_for), "MMMM d, yyyy")}
                  <Clock className="h-4 w-4 ml-3 mr-1 text-gray-500" />
                  {format(new Date(post.scheduled_for), "h:mm a")}
                </div>
              </div>
            )}
            {post.published_at && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Published At</div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                  {format(new Date(post.published_at), "MMMM d, yyyy")}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Tone / Language</div>
              <div className="capitalize">
                {post.tone} · {post.language}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Credits Used</div>
              <div className="flex items-center gap-1">
                {post.generated_by_ai && <Sparkles className="h-4 w-4 text-primary" />}
                {post.credits_used}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Title</div>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Post title"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Content</div>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                />
              </div>
            </>
          ) : (
            <>
              {post.title && <h3 className="font-semibold text-lg">{post.title}</h3>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
            </>
          )}

          {post.media_urls && post.media_urls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {post.media_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Post media ${i + 1}`}
                    className="rounded-lg object-cover w-full h-40 hover:opacity-90 transition"
                  />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publishing targets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Publishing Targets</CardTitle>
        </CardHeader>
        <CardContent>
          {post.targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No publishing targets yet. Targets are created when you publish this post to
              connected social accounts.
            </p>
          ) : (
            <div className="space-y-3">
              {post.targets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {t.platform}
                    </Badge>
                    {getStatusBadge(t.status)}
                    {t.error_message && (
                      <span className="text-xs text-red-600">{t.error_message}</span>
                    )}
                  </div>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-muted-foreground hover:text-primary"
                    title="Open on platform"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PostDetail
