"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import type { ContentPost } from "@/lib/services/content-posts"
import { platformLabel } from "@/lib/platforms"
import { PostStatusBadge } from "@/components/posts/post-status-badge"
import { PublishingPanel, postPlatforms, type PublishTarget } from "@/components/posts/publishing-panel"
import {
  type AccountRow,
  fetchSocialAccounts,
  publishingAccountFor,
} from "@/components/settings/social-accounts-api"

type PostDetailData = Omit<ContentPost, "status"> & {
  /** draft | scheduled | publishing | published | partially_published | failed */
  status: string
  targets: PublishTarget[]
}

/** Post statuses that can be sent through connected accounts right now */
const AUTO_PUBLISHABLE = ["draft", "scheduled", "failed", "partially_published"]
const POLL_MS = 5_000

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

function isRunning(post: PostDetailData | null): boolean {
  return !!post && (post.status === "publishing" || post.targets.some((t) => t.status === "publishing"))
}

const getStatusBadge = (status: string) => <PostStatusBadge status={status} />

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

  // Auto-publishing
  /** null = loading, undefined = endpoint failed (state unknown) */
  const [accounts, setAccounts] = useState<AccountRow[] | null | undefined>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [isPublishingNow, setIsPublishingNow] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  const sawPublishing = useRef(false)

  const isPublishing = isRunning(post)

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchSocialAccounts()
      setAccounts(data.accounts)
    } catch {
      setAccounts(undefined)
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        const data = await api<PostDetailData>(`/api/posts/${encodeURIComponent(postId)}`)
        setPost(data)
        setEditTitle(data.title || "")
        setEditContent(data.content)
        if (searchParams.get("edit") === "1" && !isRunning(data)) setIsEditing(true)
      } catch (error: any) {
        setLoadError(error.message || "Failed to load post.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const announceResult = useCallback(
    (status: string) => {
      switch (status) {
        case "published":
          toast({ title: "Published", description: "Your post is live on all of its platforms." })
          break
        case "partially_published":
          toast({
            title: "Partially published",
            description: "Some platforms need attention. See the Publishing section for details.",
          })
          break
        case "failed":
          toast({
            variant: "destructive",
            title: "Publishing failed",
            description: "See the Publishing section for details and retry options.",
          })
          break
        case "publishing":
          toast({ title: "Publishing…", description: "This page will update when it's done." })
          break
        default:
          toast({ title: "Publish request sent" })
      }
    },
    [toast]
  )

  // Poll every 5s while the publisher is working on this post
  useEffect(() => {
    if (!isPublishing) return
    sawPublishing.current = true
    let cancelled = false
    const id = window.setInterval(async () => {
      try {
        const data = await api<PostDetailData>(`/api/posts/${encodeURIComponent(postId)}`)
        if (!cancelled) setPost(data)
      } catch {
        // transient errors: keep polling
      }
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isPublishing, postId])

  // Announce the outcome once polling sees the publish run finish
  useEffect(() => {
    if (!post || isPublishing || !sawPublishing.current) return
    sawPublishing.current = false
    announceResult(post.status)
    loadAccounts()
  }, [post, isPublishing, announceResult, loadAccounts])

  const runAutoPublish = async (platforms?: string[]) => {
    if (!post) return
    const updated = await api<PostDetailData>(`/api/posts/${encodeURIComponent(post.id)}/publish`, {
      method: "POST",
      body: JSON.stringify(platforms ? { mode: "auto", platforms } : { mode: "auto" }),
    })
    if (isRunning(updated)) {
      // the polling effect announces the final result
      sawPublishing.current = true
      setPost(updated)
      announceResult("publishing")
    } else {
      sawPublishing.current = false
      setPost(updated)
      announceResult(updated.status)
      loadAccounts()
    }
  }

  const handlePublishNow = async () => {
    setConfirmPublish(false)
    setIsPublishingNow(true)
    try {
      await runAutoPublish()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: error.message || "Please try again.",
      })
    } finally {
      setIsPublishingNow(false)
    }
  }

  const handleRetry = async (platform: string) => {
    setRetrying(platform)
    try {
      await runAutoPublish([platform])
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: `Retry on ${platformLabel(platform)} failed`,
        description: error.message || "Please try again.",
      })
    } finally {
      setRetrying(null)
    }
  }

  const handleMarkPublished = async (platform: string, url: string | null) => {
    if (!post) return
    try {
      const updated = await api<PostDetailData>(`/api/posts/${encodeURIComponent(post.id)}/publish`, {
        method: "POST",
        body: JSON.stringify({ platforms: [{ platform, url }] }),
      })
      setPost(updated)
      toast({ title: `Marked as published on ${platformLabel(platform)}` })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not update",
        description: error.message || "Please try again.",
      })
      throw error
    }
  }

  const handleSave = async () => {
    if (!post) return
    try {
      setIsSaving(true)
      const updated = await api<ContentPost>("/api/posts", {
        method: "PUT",
        body: JSON.stringify({ postId: post.id, title: editTitle, content: editContent }),
      })
      setPost({ ...post, ...updated, status: updated.status })
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

  const pendingPlatforms = postPlatforms(post).filter(
    (p) => post.targets.find((t) => t.platform === p)?.status !== "published"
  )
  const autoPlatforms = accounts
    ? pendingPlatforms.filter((p) => publishingAccountFor(accounts, p))
    : pendingPlatforms
  const manualPlatforms = accounts
    ? pendingPlatforms.filter((p) => !publishingAccountFor(accounts, p))
    : []
  // Unknown account state (loading or endpoint failed) -> let the server decide
  const hasAnyAccount = !accounts || autoPlatforms.length > 0
  const canAutoPublish = AUTO_PUBLISHABLE.includes(post.status) && pendingPlatforms.length > 0

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {getStatusBadge(post.status)}
          {!isEditing && canAutoPublish && (
            <Button
              variant="outline"
              onClick={() => setConfirmPublish(true)}
              disabled={isPublishingNow || isPublishing || !hasAnyAccount}
              title={
                !hasAnyAccount
                  ? "Connect an account in Settings to publish automatically"
                  : undefined
              }
            >
              {isPublishingNow ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publish now
            </Button>
          )}
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isPublishing}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              disabled={isPublishing || isPublishingNow}
              title={isPublishing ? "Editing is disabled while the post is publishing" : undefined}
            >
              Edit Post
            </Button>
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
                <label htmlFor="edit-title" className="text-sm font-medium text-gray-500">
                  Title
                </label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Post title"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="edit-content" className="text-sm font-medium text-gray-500">
                  Content
                </label>
                <Textarea
                  id="edit-content"
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

      {/* Publishing status per platform */}
      <PublishingPanel
        post={post}
        accounts={accounts}
        busy={isPublishingNow || isPublishing}
        retrying={retrying}
        onRetry={handleRetry}
        onMarkPublished={handleMarkPublished}
      />

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this post now?</AlertDialogTitle>
            <AlertDialogDescription>
              {autoPlatforms.length > 0
                ? `It will be posted immediately to ${autoPlatforms.map(platformLabel).join(", ")} through your connected accounts.`
                : "It will be posted immediately through your connected accounts."}
              {manualPlatforms.length > 0 &&
                ` ${manualPlatforms.map(platformLabel).join(", ")} ${
                  manualPlatforms.length === 1 ? "has" : "have"
                } no connected account and will need to be posted manually.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublishNow}>Publish now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PostDetail
