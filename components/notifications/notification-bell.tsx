"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Hand, Loader2, Unplug } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

interface NotificationsData {
  notifications: AppNotification[]
  unread: number
}

const POLL_MS = 60_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error || `Request failed (${res.status})`)
  return body?.data as T
}

function TypeIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0"
  switch (type) {
    case "publish_succeeded":
      return <CheckCircle2 className={cn(cls, "text-green-600 dark:text-green-400")} aria-hidden="true" />
    case "publish_failed":
      return <AlertTriangle className={cn(cls, "text-destructive")} aria-hidden="true" />
    case "account_expired":
      return <Unplug className={cn(cls, "text-amber-600 dark:text-amber-400")} aria-hidden="true" />
    case "needs_manual":
      return <Hand className={cn(cls, "text-orange-600 dark:text-orange-400")} aria-hidden="true" />
    default:
      return <Bell className={cn(cls, "text-muted-foreground")} aria-hidden="true" />
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return formatDistanceToNow(d, { addSuffix: true })
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const data = await request<NotificationsData>("/api/notifications?limit=20")
      setItems(data?.notifications ?? [])
      setUnread(typeof data?.unread === "number" ? data.unread : 0)
      setFailed(false)
    } catch {
      // Fail silently: the bell is non-essential UI.
      setFailed(true)
    } finally {
      inFlight.current = false
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, POLL_MS)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [load])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const markRead = async (body: { ids?: string[]; all?: true }) => {
    try {
      const res = await request<{ unread?: number } | null>("/api/notifications", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (typeof res?.unread === "number") setUnread(res.unread)
    } catch {
      // ignore; next poll will reconcile
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    await markRead({ all: true })
    setMarkingAll(false)
  }

  const handleClick = (n: AppNotification) => {
    if (!n.read_at) {
      const now = new Date().toISOString()
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)))
      setUnread((u) => Math.max(0, u - 1))
      void markRead({ ids: [n.id] })
    }
    setOpen(false)
    if (n.link) {
      if (n.link.startsWith("/")) router.push(n.link)
      else if (/^https?:\/\//.test(n.link)) window.location.href = n.link
    }
  }

  const badge = unread > 99 ? "99+" : String(unread)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handleMarkAll}
            disabled={unread === 0 || markingAll}
          >
            {markingAll ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
            )}
            Mark all read
          </Button>
        </div>

        {!loaded ? (
          <div className="space-y-3 p-4" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {failed ? "Notifications are unavailable right now." : "You're all caught up."}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <ul className="divide-y" role="list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      !n.read_at && "bg-muted/40"
                    )}
                  >
                    <TypeIcon type={n.type} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {relativeTime(n.created_at)}
                      </span>
                    </span>
                    {!n.read_at && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default NotificationBell
