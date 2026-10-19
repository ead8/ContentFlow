import { createClient } from '@/lib/supabase/server'
import { requireUserId } from './auth'
import { ValidationError } from '@/lib/api/error'

export interface CalendarEvent {
  id: string
  user_id: string
  post_id: string | null
  title: string
  description: string | null
  event_date: string
  timezone: string
  event_type: string
  status: string
  created_at: string
  updated_at: string
}

const EVENT_TYPES = ['post', 'campaign', 'reminder', 'other']

function parseDate(input: unknown, field: string): string {
  if (typeof input !== 'string') throw new ValidationError(`${field} must be an ISO date string`)
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${field} is not a valid date`)
  return d.toISOString()
}

function parseTitle(input: unknown): string {
  const title = typeof input === 'string' ? input.trim() : ''
  if (!title) throw new ValidationError('Title is required')
  if (title.length > 200) throw new ValidationError('Title must be at most 200 characters')
  return title
}

/**
 * Create a calendar event (a campaign, reminder, or planned post).
 */
export async function createScheduledEvent(input: {
  title?: unknown
  eventDate?: unknown
  description?: unknown
  timezone?: unknown
  eventType?: unknown
  postId?: unknown
}): Promise<CalendarEvent> {
  const supabase = createClient()
  const userId = await requireUserId()

  const eventType =
    typeof input.eventType === 'string' && EVENT_TYPES.includes(input.eventType)
      ? input.eventType
      : 'other'

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: userId,
      title: parseTitle(input.title),
      event_date: parseDate(input.eventDate, 'eventDate'),
      post_id: typeof input.postId === 'string' ? input.postId : null,
      description: typeof input.description === 'string' ? input.description.slice(0, 2000) : null,
      timezone: typeof input.timezone === 'string' ? input.timezone.slice(0, 64) : 'UTC',
      event_type: eventType,
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}

/**
 * Calendar events in a date range.
 */
export async function getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const supabase = createClient()
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', parseDate(startDate, 'startDate'))
    .lte('event_date', parseDate(endDate, 'endDate'))
    .order('event_date', { ascending: true })

  if (error) throw error
  return data as CalendarEvent[]
}

/**
 * Events in the next N days.
 */
export async function getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const now = new Date()
  const end = new Date(now.getTime() + Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000)
  return getCalendarEvents(now.toISOString(), end.toISOString())
}

/**
 * Update the editable fields of an event.
 */
export async function updateScheduledEvent(
  eventId: string,
  input: { title?: unknown; description?: unknown; eventDate?: unknown; status?: unknown }
): Promise<CalendarEvent> {
  const supabase = createClient()
  const userId = await requireUserId()

  const updates: Record<string, unknown> = {}
  if (input.title !== undefined) updates.title = parseTitle(input.title)
  if (input.description !== undefined) {
    updates.description = typeof input.description === 'string' ? input.description.slice(0, 2000) : null
  }
  if (input.eventDate !== undefined) updates.event_date = parseDate(input.eventDate, 'eventDate')
  if (input.status !== undefined) {
    if (!['scheduled', 'done', 'cancelled'].includes(String(input.status))) {
      throw new ValidationError('status must be scheduled, done or cancelled')
    }
    updates.status = input.status
  }
  if (Object.keys(updates).length === 0) throw new ValidationError('Nothing to update')
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Event not found')
  return data as CalendarEvent
}

/**
 * Delete an event.
 */
export async function deleteScheduledEvent(eventId: string): Promise<void> {
  const supabase = createClient()
  const userId = await requireUserId()

  const { data, error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Event not found')
}

/**
 * Commonly cited good posting times per platform (local time, 24h).
 */
export function getOptimalPostingTimes(platform: string): string[] {
  const optimalTimes: Record<string, string[]> = {
    linkedin: ['08:00', '12:00', '17:00'],
    instagram: ['06:00', '11:00', '19:00'],
    'x-twitter': ['08:00', '12:00', '17:00'],
    facebook: ['09:00', '13:00', '19:00'],
    youtube_shorts: ['14:00', '16:00', '20:00'],
    tiktok: ['07:00', '12:00', '19:00'],
  }

  return optimalTimes[platform.toLowerCase()] || ['12:00']
}
