"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, CalendarDays, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface CalEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: string
  status: string
  post_id: string | null
  kind: "event" | "post"
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CalendarPage() {
  const { toast } = useToast()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => {
    const start = new Date(cursor); start.setDate(start.getDate() - 7)
    const end = new Date(cursor); end.setMonth(end.getMonth() + 1); end.setDate(end.getDate() + 7)
    return { start, end }
  }, [cursor])

  const load = async () => {
    setLoading(true)
    try {
      const [evts, posts] = await Promise.all([
        api<any[]>(`/api/calendar?type=range&startDate=${range.start.toISOString()}&endDate=${range.end.toISOString()}`),
        api<any[]>(`/api/posts?limit=100`),
      ])
      const items: CalEvent[] = (evts || []).map((e: any) => ({ ...e, kind: "event" as const }))
      for (const p of posts || []) {
        if (p.scheduled_for) {
          items.push({
            id: p.id, title: p.title || "Scheduled post", description: p.content?.slice(0, 80) || null,
            event_date: p.scheduled_for, event_type: "post", status: p.status, post_id: p.id, kind: "post" as const,
          })
        }
      }
      setEvents(items)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not load calendar", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [cursor])

  const days = useMemo(() => {
    const first = startOfMonth(cursor)
    const startPad = first.getDay()
    const cells: Date[] = []
    for (let i = startPad; i > 0; i--) cells.push(new Date(first.getFullYear(), first.getMonth(), 1 - i))
    const dim = endOfMonth(cursor).getDate()
    for (let d = 1; d <= dim; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]
      cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))
    }
    return cells
  }, [cursor])

  const eventsFor = (day: Date) => events.filter((e) => sameDay(new Date(e.event_date), day))
  const selectedEvents = selectedDay ? eventsFor(selectedDay) : []

  const handleCreate = async () => {
    if (!newTitle.trim() || !selectedDay) return
    setSaving(true)
    try {
      await api("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          eventDate: selectedDay.toISOString(),
          eventType: "post",
        }),
      })
      setNewTitle(""); setNewDesc(""); setShowCreate(false)
      toast({ title: "Event created" })
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Create failed", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ev: CalEvent) => {
    if (ev.kind === "post") {
      toast({ title: "Scheduled post", description: "Edit or delete it from the Posts page." })
      return
    }
    try {
      await api(`/api/calendar?id=${ev.id}`, { method: "DELETE" })
      toast({ title: "Event deleted" })
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message })
    }
  }

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" })

  return (
    <main className="mx-auto max-w-6xl py-6 px-4 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm text-muted-foreground">Scheduled posts and planned events, all in one view.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => { setCursor(startOfMonth(new Date())); setSelectedDay(new Date()) }}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">{monthLabel}</h2>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                  const inMonth = day.getMonth() === cursor.getMonth()
                  const items = eventsFor(day)
                  const isToday = sameDay(day, new Date())
                  const isSel = selectedDay && sameDay(day, selectedDay)
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[88px] rounded-lg border p-1.5 text-left align-top transition-colors hover:bg-accent ${
                        isSel ? "border-primary ring-1 ring-primary" : "border-border"
                      } ${inMonth ? "" : "opacity-40"}`}
                    >
                      <div className={`text-xs font-medium mb-1 flex justify-center w-6 h-6 items-center rounded-full ${
                        isToday ? "bg-primary text-primary-foreground" : ""
                      }`}>{day.getDate()}</div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((e) => (
                          <div key={e.id} className={`truncate text-[10px] px-1 py-0.5 rounded ${
                            e.kind === "post" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
                          }`} title={e.title}>{e.title}</div>
                        ))}
                        {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-200 inline-block" /> Scheduled post</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-violet-200 inline-block" /> Planned event</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {selectedDay ? selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Select a day"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedDay && <p className="text-sm text-muted-foreground">Click any day to see what is scheduled.</p>}
              {selectedEvents.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.event_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {" · "}{e.kind === "post" ? "Scheduled post" : e.event_type}
                    </div>
                  </div>
                  {e.kind === "event" && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {selectedDay && selectedEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled this day.</p>
              )}
              {selectedDay && !showCreate && (
                <Button className="w-full" variant="outline" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add event
                </Button>
              )}
              {showCreate && selectedDay && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New event</span>
                    <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></Button>
                  </div>
                  <Input placeholder="Event title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                  <Button className="w-full" onClick={handleCreate} disabled={saving || !newTitle.trim()}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save event
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
