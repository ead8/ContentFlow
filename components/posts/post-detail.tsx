"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ArrowLeft, CalendarClock, Check, Copy, Loader2, Send, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  api,
  deletePost,
  fetchPost,
  recordMetrics,
  updatePost,
  type MetricTotals,
  type PostDetail as PostDetailData,
} from "@/lib/api/client"
import type { PlatformPost } from "@/models/content"
import { composeVariantText, platformLabel } from "@/lib/platforms"
import CampaignContentTab from "@/components/generate/CampaignContentTab"
import { PostStatusBadge } from "./post-status-badge"
import { PublishingPanel, postPlatforms } from "./publishing-panel"
import { type AccountRow, fetchSocialAccounts, publishingAccountFor } from "@/components/settings/social-accounts-api"

const METRICS: { key: keyof MetricTotals; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "clicks", label: "Clicks" },
]

/** Post statuses that can be sent through connected accounts right now */
const AUTO_PUBLISHABLE = ["draft", "scheduled", "failed", "partially_published"]
const POLL_MS = 5_000

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Variants for display; posts created without platforms get a single text view */
function variantsOf(post: PostDetailData): Record<string, PlatformPost> {
  const out: Record<string, PlatformPost> = {}
  for (const p of post.platforms) if (post.platform_variants?.[p]) out[p] = post.platform_variants[p]
  return out
}

function isRunning(post: PostDetailData | null): boolean {
  return !!post && (post.status === "publishing" || post.targets.some((t) => t.status === "publishing"))
}

const PostDetail = ({ postId }: { postId: string }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [post, setPost] = useState<PostDetailData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftContent, setDraftContent] = useState("")
  const [draftVariants, setDraftVariants] = useState<Record<string, PlatformPost>>({})
  const [isSaving, setIsSaving] = useState(false)

  const [scheduleInput, setScheduleInput] = useState("")
  const [isScheduling, setIsScheduling] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [metricsPlatform, setMetricsPlatform] = useState<string>("")
  const [metricsInput, setMetricsInput] = useState<Partial<Record<keyof MetricTotals, string>>>({})
  const [savingMetrics, setSavingMetrics] = useState(false)

  // Auto-publishing (null = loading, undefined = accounts endpoint failed)
  const [accounts, setAccounts] = useState<AccountRow[] | null | undefined>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [isPublishingNow, setIsPublishingNow] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  const sawPublishing = useRef(false)

  const isPublishing = isRunning(post)

  const applyPost = useCallback((data: PostDetailData) => {
    setPost(data)
    setDraftTitle(data.title || "")
    setDraftContent(data.content)
    setDraftVariants(variantsOf(data))
    setScheduleInput(toLocalInput(data.scheduled_for))
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts((await fetchSocialAccounts()).accounts)
    } catch {
      setAccounts(undefined)
    }
  }, [])

  useEffect(() => {
    fetchPost(postId)
      .then((data) => {
        applyPost(data)
        if (searchParams.get("edit") === "1" && !isRunning(data)) setIsEditing(true)
      })
      .catch((e) => setLoadError(e.message || "Failed to load post."))
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
          toast({ title: "Partially published", description: "Some platforms need attention. See Publishing below." })
          break
        case "failed":
          toast({ variant: "destructive", title: "Publishing failed", description: "See Publishing below for details and retry options." })
          break
        case "publishing":
          toast({ title: "Publishing…", description: "This page updates when it's done." })
          break
        default:
          toast({ title: "Publish request sent" })
      }
    },
    [toast]
  )

  // Poll while the publisher is working on this post
  useEffect(() => {
    if (!isPublishing) return
    sawPublishing.current = true
    let cancelled = false
    const id = window.setInterval(async () => {
      try {
        const data = await fetchPost(postId)
        if (!cancelled) applyPost(data)
      } catch {
        // transient: keep polling
      }
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isPublishing, postId, applyPost])

  // Announce the outcome once polling sees the run finish
  useEffect(() => {
    if (!post || isPublishing || !sawPublishing.current) return
    sawPublishing.current = false
    announceResult(post.status)
    loadAccounts()
  }, [post, isPublishing, announceResult, loadAccounts])

  // Default the results form to the first published platform
  useEffect(() => {
    if (!post) return
    const published = post.targets.filter((t) => t.status === "published").map((t) => t.platform)
    if (!metricsPlatform || !published.includes(metricsPlatform)) setMetricsPlatform(published[0] || "")
  }, [post, metricsPlatform])

  useEffect(() => {
    if (!post || !metricsPlatform) return
    const values: Partial<Record<keyof MetricTotals, string>> = {}
    for (const m of post.metrics) {
      if (m.platform === metricsPlatform) values[m.engagement_type as keyof MetricTotals] = String(m.count)
    }
    setMetricsInput(values)
  }, [post, metricsPlatform])

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="mb-4 text-destructive">{loadError}</p>
          <Button variant="outline" asChild>
            <Link href="/posts">Back to posts</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!post) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const variants = variantsOf(post)
  const hasVariants = Object.keys(variants).length > 0
  const publishedPlatforms = post.targets.filter((t) => t.status === "published").map((t) => t.platform)
  const images = (post.media_urls || []).filter((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u))
  const videos = (post.media_urls || []).filter((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u))

  const pendingPlatforms = postPlatforms(post).filter((p) => !publishedPlatforms.includes(p))
  const autoPlatforms = accounts ? pendingPlatforms.filter((p) => publishingAccountFor(accounts, p)) : []
  const manualPlatforms = accounts ? pendingPlatforms.filter((p) => !publishingAccountFor(accounts, p)) : []
  const canPublishNow = AUTO_PUBLISHABLE.includes(post.status) && autoPlatforms.length > 0 && !isPublishing

  const runAutoPublish = async (platforms?: string[]) => {
    const updated = await api<PostDetailData>(`/api/posts/${encodeURIComponent(post.id)}/publish`, {
      method: "POST",
      body: JSON.stringify(platforms ? { mode: "auto", platforms } : { mode: "auto" }),
    })
    applyPost(updated)
    if (isRunning(updated)) {
      sawPublishing.current = true
      announceResult("publishing")
    } else {
      sawPublishing.current = false
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
      toast({ variant: "destructive", title: "Publish failed", description: error.message || "Please try again." })
    } finally {
      setIsPublishingNow(false)
    }
  }

  const handleRetry = async (platform: string) => {
    setRetrying(platform)
    try {
      await runAutoPublish([platform])
    } catch (error: any) {
      toast({ variant: "destructive", title: `Retry on ${platformLabel(platform)} failed`, description: error.message })
    } finally {
      setRetrying(null)
    }
  }

  const handleMarkPublished = async (platform: string, url: string | null) => {
    try {
      const updated = await api<PostDetailData>(`/api/posts/${encodeURIComponent(post.id)}/publish`, {
        method: "POST",
        body: JSON.stringify({ platforms: [{ platform, url }] }),
      })
      applyPost(updated)
      toast({ title: `Marked as published on ${platformLabel(platform)}` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not update", description: error.message })
      throw error
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const firstText = hasVariants
        ? Object.values(draftVariants).map((v) => v.post || v.caption || "").find((t) => t.trim())
        : draftContent
      await updatePost(post.id, {
        title: draftTitle,
        content: firstText || draftContent,
        ...(hasVariants ? { platform_variants: draftVariants } : {}),
      })
      applyPost(await fetchPost(post.id))
      setIsEditing(false)
      toast({ title: "Changes saved" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not save", description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSchedule = async (clear = false) => {
    if (!clear && !scheduleInput) return
    setIsScheduling(true)
    try {
      await updatePost(post.id, { scheduled_for: clear ? null : new Date(scheduleInput).toISOString() })
      applyPost(await fetchPost(post.id))
      toast({ title: clear ? "Schedule removed" : "Schedule updated" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not update schedule", description: error.message })
    } finally {
      setIsScheduling(false)
    }
  }

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Select the text and copy it manually." })
    }
  }

  const handleSaveMetrics = async () => {
    setSavingMetrics(true)
    try {
      const metrics: Partial<MetricTotals> = {}
      for (const { key } of METRICS) {
        const raw = metricsInput[key]?.trim()
        if (raw) metrics[key] = Number(raw)
      }
      applyPost(await recordMetrics(post.id, metricsPlatform, metrics))
      toast({ title: "Results saved" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not save results", description: error.message })
    } finally {
      setSavingMetrics(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return
    try {
      await deletePost(post.id)
      toast({ title: "Post deleted" })
      router.push("/posts")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message })
    }
  }

  const canSchedule = !["published", "publishing"].includes(post.status) && !isPublishing

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/posts">
              <ArrowLeft className="mr-2 h-4 w-4" /> My Posts
            </Link>
          </Button>
          <h1 className="break-words text-2xl font-bold">{post.title || post.content.slice(0, 60)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PostStatusBadge status={post.status} />
            {post.generated_by_ai && (
              <span className="flex items-center gap-1"><Sparkles className="h-4 w-4" /> AI generated</span>
            )}
            <span>Created {format(new Date(post.created_at), "MMM d, yyyy")}</span>
            {post.published_at && <span>· Published {format(new Date(post.published_at), "MMM d, yyyy")}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => { applyPost(post); setIsEditing(false) }} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              {canPublishNow && (
                <Button onClick={() => setConfirmPublish(true)} disabled={isPublishingNow}>
                  {isPublishingNow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Publish now
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsEditing(true)} disabled={isPublishing}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPublishing} aria-label="Delete post">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isEditing ? "Edit content" : "Content"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={300} />
              </div>
              {hasVariants ? (
                <CampaignContentTab
                  posts={draftVariants}
                  onUpdate={(platform, field, value) =>
                    setDraftVariants((prev) => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }))
                  }
                />
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea id="edit-content" value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={10} />
                </div>
              )}
            </>
          ) : hasVariants ? (
            <Tabs defaultValue={Object.keys(variants)[0]}>
              <TabsList className="flex h-auto flex-wrap justify-start">
                {Object.keys(variants).map((p) => (
                  <TabsTrigger key={p} value={p} className="gap-2">
                    {platformLabel(p)}
                    {publishedPlatforms.includes(p) && <Check className="h-3.5 w-3.5 text-green-600" />}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(variants).map(([platform, v]) => {
                const text = composeVariantText(v)
                return (
                  <TabsContent key={platform} value={platform} className="space-y-3">
                    <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">{text}</div>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(platform, text)}>
                      {copied === platform ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied === platform ? "Copied" : "Copy text"}
                    </Button>
                  </TabsContent>
                )
              })}
            </Tabs>
          ) : (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
              <Button variant="outline" size="sm" onClick={() => handleCopy("content", post.content)}>
                {copied === "content" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied === "content" ? "Copied" : "Copy text"}
              </Button>
            </div>
          )}

          {(images.length > 0 || videos.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Media</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {images.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Post media" className="w-full rounded-lg border object-cover" />
                  </a>
                ))}
                {videos.map((url) => (
                  <video key={url} src={url} controls className="w-full rounded-lg border" />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publishing: per-platform status, retries and manual fallback */}
      <PublishingPanel
        post={post}
        accounts={accounts}
        busy={isPublishingNow || isPublishing}
        retrying={retrying}
        onRetry={handleRetry}
        onMarkPublished={handleMarkPublished}
      />

      {/* Schedule */}
      {canSchedule && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5" /> Schedule
            </CardTitle>
            <CardDescription>
              {post.scheduled_for && post.status === "scheduled"
                ? `Scheduled for ${format(new Date(post.scheduled_for), "EEEE, MMMM d 'at' h:mm a")}.${
                    autoPlatforms.length ? ` It will publish automatically to ${autoPlatforms.map(platformLabel).join(", ")}.` : ""
                  }${manualPlatforms.length ? ` ${manualPlatforms.map(platformLabel).join(", ")} will need posting by hand.` : ""}`
                : "Pick a time to publish automatically through your connected accounts."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="datetime-local"
              value={scheduleInput}
              min={toLocalInput(new Date().toISOString())}
              onChange={(e) => setScheduleInput(e.target.value)}
              className="sm:w-64"
              aria-label="Scheduled time"
            />
            <Button onClick={() => handleSchedule(false)} disabled={isScheduling || !scheduleInput}>
              {post.status === "scheduled" ? "Reschedule" : "Schedule"}
            </Button>
            {post.status === "scheduled" && (
              <Button variant="ghost" onClick={() => handleSchedule(true)} disabled={isScheduling}>
                Unschedule
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Results</CardTitle>
          <CardDescription>
            Numbers for auto-published posts sync from the platforms every few hours. You can also enter the latest
            figures here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {publishedPlatforms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Results appear once the post is published on a platform.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {publishedPlatforms.map((p) => (
                  <Button key={p} size="sm" variant={p === metricsPlatform ? "default" : "outline"} onClick={() => setMetricsPlatform(p)}>
                    {platformLabel(p)}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {METRICS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`metric-${key}`} className="text-xs">{label}</Label>
                    <Input
                      id={`metric-${key}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={metricsInput[key] ?? ""}
                      onChange={(e) => setMetricsInput((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveMetrics} disabled={savingMetrics}>
                {savingMetrics && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this post now?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be posted immediately to {autoPlatforms.map(platformLabel).join(", ")} through your connected
              accounts.
              {manualPlatforms.length > 0 &&
                ` ${manualPlatforms.map(platformLabel).join(", ")} ${manualPlatforms.length === 1 ? "has" : "have"} no connected account and will need to be posted manually.`}
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
