"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Link2, Loader2, RefreshCw, Star, Unplug } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { platformLabel } from "@/lib/platforms"
import { cn } from "@/lib/utils"
import {
  type AccountRow,
  type PlatformInfo,
  PLATFORM_SLUG,
  connectUrl,
  fetchSocialAccounts,
  platformIcon,
  socialApi,
} from "./social-accounts-api"

const RETURN_TO = "/settings"

function labelForSlug(slug: string, platforms: PlatformInfo[]): string {
  const fromApi = platforms.find((p) => p.slug === slug)?.label
  if (fromApi) return fromApi
  const platform = Object.keys(PLATFORM_SLUG).find((k) => PLATFORM_SLUG[k] === slug)
  return platform ? platformLabel(platform) : slug
}

function initials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
}

function formatAccountType(type: string | null): string | null {
  if (!type) return null
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function AccountStatusBadge({ account }: { account: AccountRow }) {
  if (account.status === "active") {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
        Active
      </Badge>
    )
  }
  if (account.status === "expired") {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Reconnect needed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
      Error
    </Badge>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  )
}

export function ConnectedAccounts() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const handledParams = useRef(false)

  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null)
  const [toDisconnect, setToDisconnect] = useState<AccountRow | null>(null)

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchSocialAccounts()
      setAccounts(data.accounts)
      setPlatforms(data.platforms)
    } catch (e: any) {
      setLoadError(e?.message || "Could not load connected accounts.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Result of the OAuth round trip: ?connected=slug&count=N or ?connect_error=msg
  useEffect(() => {
    if (handledParams.current) return
    const connected = searchParams.get("connected")
    const count = searchParams.get("count")
    const connectError = searchParams.get("connect_error")
    if (!connected && !connectError) return
    handledParams.current = true

    if (connectError) {
      toast({ variant: "destructive", title: "Could not connect account", description: connectError })
    } else if (connected) {
      const label = labelForSlug(connected, platforms)
      const n = Number(count)
      if (count !== null && Number.isFinite(n) && n === 0) {
        toast({
          variant: "destructive",
          title: `No ${label} accounts connected`,
          description: `We couldn't find any ${label} accounts you can publish to.`,
        })
      } else {
        toast({
          title: `${label} connected`,
          description:
            Number.isFinite(n) && n > 1
              ? `${n} accounts connected. Scheduled posts will publish automatically.`
              : "Scheduled posts will now publish automatically.",
        })
      }
    }

    const rest = new URLSearchParams(searchParams.toString())
    rest.delete("connected")
    rest.delete("count")
    rest.delete("connect_error")
    const qs = rest.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }, [searchParams, pathname, router, toast, platforms])

  // Honour /settings#accounts once the card has content
  useEffect(() => {
    if (loading) return
    if (typeof window !== "undefined" && window.location.hash === "#accounts") {
      cardRef.current?.scrollIntoView({ block: "start" })
    }
  }, [loading])

  const handleConnect = (slug: string) => {
    setConnectingSlug(slug)
    window.location.href = connectUrl(slug, RETURN_TO)
  }

  const handleMakeDefault = async (account: AccountRow) => {
    setBusyId(account.id)
    try {
      await socialApi<AccountRow[]>("/api/social-accounts", {
        method: "PATCH",
        body: JSON.stringify({ id: account.id }),
      })
      setAccounts((prev) =>
        prev.map((a) => (a.platform === account.platform ? { ...a, is_default: a.id === account.id } : a))
      )
      toast({ title: "Default account updated", description: `${account.account_name || "This account"} will be used for ${platformLabel(account.platform)}.` })
      load({ silent: true })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not update default", description: e?.message })
    } finally {
      setBusyId(null)
    }
  }

  const handleDisconnect = async (account: AccountRow) => {
    setBusyId(account.id)
    try {
      await socialApi(`/api/social-accounts?id=${encodeURIComponent(account.id)}`, { method: "DELETE" })
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      toast({ title: "Account disconnected", description: account.account_name || platformLabel(account.platform) })
      load({ silent: true })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Disconnect failed", description: e?.message })
    } finally {
      setBusyId(null)
      setToDisconnect(null)
    }
  }

  return (
    <Card id="accounts" ref={cardRef} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          Connect your social accounts so scheduled posts are published automatically. Platforms without a
          connected account fall back to manual posting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <span className="sr-only" role="status">Loading connected accounts…</span>
            <LoadingRows />
          </>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No publishing platforms are available yet.</p>
        ) : (
          <ul className="space-y-3">
            {platforms.map((p) => {
              const Icon = platformIcon(p.platform)
              const list = accounts.filter((a) => a.platform === p.platform)
              const multiple = list.length > 1
              const needsReconnect = list.some((a) => a.status !== "active")
              const connecting = connectingSlug === p.slug
              const label = p.label || platformLabel(p.platform)
              return (
                <li key={p.slug} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {!p.configured
                            ? "Not configured on this server"
                            : list.length === 0
                              ? "Not connected"
                              : `${list.length} account${list.length === 1 ? "" : "s"} connected`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={list.length === 0 || needsReconnect ? "default" : "outline"}
                      disabled={!p.configured || connecting}
                      onClick={() => handleConnect(p.slug)}
                      aria-label={
                        !p.configured
                          ? `${label} is not configured`
                          : list.length === 0
                            ? `Connect ${label}`
                            : needsReconnect
                              ? `Reconnect ${label}`
                              : `Connect another ${label} account`
                      }
                      title={!p.configured ? "This platform's API keys haven't been set up yet." : undefined}
                    >
                      {connecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : needsReconnect ? (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      {!p.configured
                        ? "Not configured"
                        : list.length === 0
                          ? "Connect"
                          : needsReconnect
                            ? "Reconnect"
                            : "Add account"}
                    </Button>
                  </div>

                  {list.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {list.map((a) => {
                        const busy = busyId === a.id
                        const type = formatAccountType(a.account_type)
                        return (
                          <li
                            key={a.id}
                            className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {a.avatar_url && <AvatarImage src={a.avatar_url} alt="" />}
                                <AvatarFallback className="text-xs">{initials(a.account_name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-medium">
                                    {a.account_name || a.account_id}
                                  </span>
                                  <AccountStatusBadge account={a} />
                                  {multiple && a.is_default && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Star className="h-3 w-3" aria-hidden="true" /> Default
                                    </Badge>
                                  )}
                                </div>
                                {type && <p className="text-xs text-muted-foreground">{type}</p>}
                                {a.status !== "active" && (
                                  <p
                                    className={cn(
                                      "mt-0.5 flex items-start gap-1 text-xs",
                                      a.status === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                                    )}
                                  >
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                    <span className="line-clamp-2" title={a.last_error || undefined}>
                                      {a.last_error ||
                                        (a.status === "expired"
                                          ? "Access expired. Reconnect to keep auto-publishing."
                                          : "Something went wrong with this account.")}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              {multiple && !a.is_default && a.status === "active" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleMakeDefault(a)}
                                >
                                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Make default
                                </Button>
                              )}
                              {a.status !== "active" && p.configured && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={connecting}
                                  onClick={() => handleConnect(p.slug)}
                                  aria-label={`Reconnect ${a.account_name || label}`}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" /> Reconnect
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                disabled={busy}
                                onClick={() => setToDisconnect(a)}
                                aria-label={`Disconnect ${a.account_name || label}`}
                              >
                                <Unplug className="mr-2 h-4 w-4" /> Disconnect
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!toDisconnect} onOpenChange={(open) => !open && !busyId && setToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {toDisconnect?.account_name || "this account"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Scheduled posts for {toDisconnect ? platformLabel(toDisconnect.platform) : "this platform"} will no
              longer publish automatically through this account. You can reconnect it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!busyId}
              onClick={(e) => {
                e.preventDefault()
                if (toDisconnect) handleDisconnect(toDisconnect)
              }}
            >
              {busyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export default ConnectedAccounts
