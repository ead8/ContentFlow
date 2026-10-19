"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNowStrict } from "date-fns"
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Link2, Loader2, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PostStatusBadge } from "@/components/posts/post-status-badge"
import {
  type AccountRow,
  platformIcon,
  publishingAccountFor,
} from "@/components/settings/social-accounts-api"
import { composeVariantText, composerUrl, platformLabel } from "@/lib/platforms"

export interface PublishTarget {
  id: string
  platform: string
  status: string
  published_at: string | null
  external_url: string | null
  error_message: string | null
  social_account_id?: string | null
  external_id?: string | null
  attempts?: number | null
  next_attempt_at?: string | null
  last_attempt_at?: string | null
}

export interface PublishablePost {
  id: string
  status: string
  content: string
  platforms?: string[] | null
  platform_variants?: Record<string, any> | null
  targets: PublishTarget[]
}

/** Platforms a post goes to: its platforms, else variant keys, plus any existing targets. */
export function postPlatforms(post: PublishablePost): string[] {
  const base = post.platforms?.length ? post.platforms : Object.keys(post.platform_variants || {})
  const all = [...base]
  for (const t of post.targets) if (!all.includes(t.platform)) all.push(t.platform)
  return all
}

export function textForPlatform(post: PublishablePost, platform: string): string {
  const v = post.platform_variants?.[platform]
  return (v && composeVariantText(v)) || post.content
}

interface PublishingPanelProps {
  post: PublishablePost
  /** null while loading; undefined when the accounts endpoint failed */
  accounts: AccountRow[] | null | undefined
  /** Whole post is being published (auto) */
  busy: boolean
  retrying: string | null
  onRetry: (platform: string) => void
  onMarkPublished: (platform: string, url: string | null) => Promise<void>
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function PublishingPanel({ post, accounts, busy, retrying, onRetry, onMarkPublished }: PublishingPanelProps) {
  const now = useNow(30_000)
  const [manualFor, setManualFor] = useState<string | null>(null)
  const [manualUrl, setManualUrl] = useState("")
  const [savingManual, setSavingManual] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const platforms = postPlatforms(post)
  const postPublishing = post.status === "publishing"

  const handleCopyOpen = (platform: string) => {
    const text = textForPlatform(post, platform)
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(platform)
        window.setTimeout(() => setCopied((c) => (c === platform ? null : c)), 2500)
      })
      .catch(() => {})
    window.open(composerUrl(platform, text), "_blank", "noopener,noreferrer")
  }

  const submitManual = async () => {
    if (!manualFor) return
    setSavingManual(true)
    try {
      await onMarkPublished(manualFor, manualUrl.trim() || null)
      setManualFor(null)
      setManualUrl("")
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Publishing</CardTitle>
        <CardDescription>
          Status on each platform. Connected accounts publish automatically; others can be posted manually.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This post has no target platforms yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {platforms.map((platform) => {
              const target = post.targets.find((t) => t.platform === platform)
              const status = target?.status ?? "pending"
              const label = platformLabel(platform)
              const Icon = platformIcon(platform)
              const account = accounts ? publishingAccountFor(accounts, platform) : null
              const hasInactive = !!accounts?.some((a) => a.platform === platform && a.status !== "active")
              const noAccount = accounts !== null && accounts !== undefined && !account
              const isPublished = status === "published"
              const showManual = !isPublished && (status === "needs_manual" || noAccount)
              // Cron doesn't retry needs_manual or permanently failed targets; Retry gives fresh attempts
              const canRetry =
                (status === "failed" || status === "needs_manual") && !!account && !postPublishing && !busy
              const nextAt = target?.next_attempt_at ? new Date(target.next_attempt_at) : null
              const attempts = target?.attempts ?? 0
              const retryScheduled = status === "failed" && !!nextAt && nextAt.getTime() > now
              const permanentlyFailed = status === "failed" && !nextAt

              return (
                <li key={platform} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          <PostStatusBadge status={status} />
                        </div>

                        {/* Account line */}
                        <div className="text-xs text-muted-foreground">
                          {accounts === null ? (
                            <Skeleton className="h-3 w-32" />
                          ) : account ? (
                            <>via {account.account_name || "connected account"}</>
                          ) : accounts === undefined ? null : (
                            <Link href="/settings#accounts" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                              <Link2 className="h-3 w-3" aria-hidden="true" />
                              {hasInactive ? `Reconnect ${label}` : `Connect ${label}`}
                            </Link>
                          )}
                        </div>

                        {isPublished && target?.published_at && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                            Published {format(new Date(target.published_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}

                        {target?.error_message && !isPublished && (
                          <p className="flex items-start gap-1 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="break-words">{target.error_message}</span>
                          </p>
                        )}

                        {status === "needs_manual" && !target?.error_message && (
                          <p className="text-xs text-muted-foreground">
                            {account
                              ? "No connected account was available at publish time. Retry to publish it automatically now."
                              : "No connected account was available, so this platform needs a manual post."}
                          </p>
                        )}

                        {permanentlyFailed && (
                          <p className="text-xs text-muted-foreground">
                            Won&apos;t be retried automatically.
                            {account ? " Use Retry to try again." : ""}
                          </p>
                        )}

                        {(attempts > 0 || nextAt) && !isPublished && (
                          <p className="text-xs text-muted-foreground">
                            {attempts > 0 && `${attempts} attempt${attempts === 1 ? "" : "s"}`}
                            {attempts > 0 && nextAt && " · "}
                            {nextAt &&
                              (nextAt.getTime() > now
                                ? `Retrying in ${formatDistanceToNowStrict(nextAt)}`
                                : "Retry pending")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {target?.external_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={target.external_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                            View post
                            <span className="sr-only"> on {label} (opens in a new tab)</span>
                          </a>
                        </Button>
                      )}
                      {canRetry && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRetry(platform)}
                          disabled={retrying !== null}
                          aria-label={`${retryScheduled ? "Retry now" : status === "needs_manual" ? "Publish" : "Retry"} to ${label}`}
                        >
                          {retrying === platform ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="mr-2 h-4 w-4" />
                          )}
                          {retryScheduled ? "Retry now" : status === "needs_manual" ? "Publish" : "Retry"}
                        </Button>
                      )}
                      {showManual && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyOpen(platform)}
                            aria-label={`Copy text and open ${label} composer`}
                          >
                            {copied === platform ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            {copied === platform ? "Copied" : "Copy & open"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setManualFor(platform)
                              setManualUrl("")
                            }}
                            disabled={postPublishing}
                          >
                            Mark as published
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!manualFor} onOpenChange={(open) => !open && !savingManual && setManualFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as published on {manualFor ? platformLabel(manualFor) : ""}</DialogTitle>
            <DialogDescription>
              Paste the link to the live post so you can find it later. This is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="manual-url">Post URL</Label>
            <Input
              id="manual-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitManual()
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setManualFor(null)} disabled={savingManual}>
              Cancel
            </Button>
            <Button onClick={submitManual} disabled={savingManual}>
              {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark as published
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default PublishingPanel
