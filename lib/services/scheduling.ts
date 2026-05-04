import { createClient } from '@/lib/supabase/server'

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

/**
 * Create a scheduled event
 */
export async function createScheduledEvent(
  title: string,
  eventDate: string,
  options?: {
    postId?: string
    description?: string
    timezone?: string
    eventType?: string
  }
): Promise<CalendarEvent> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: user.id,
      title,
      event_date: eventDate,
      post_id: options?.postId,
      description: options?.description,
      timezone: options?.timezone || 'UTC',
      event_type: options?.eventType || 'post',
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}

/**
 * Get user's calendar events for a date range
 */
export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })

  if (error) throw error
  return data as CalendarEvent[]
}

/**
 * Get upcoming events for the next N days
 */
export async function getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const now = new Date()
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('event_date', now.toISOString())
    .lte('event_date', endDate.toISOString())
    .order('event_date', { ascending: true })

  if (error) throw error
  return data as CalendarEvent[]
}

/**
 * Update a scheduled event
 */
export async function updateScheduledEvent(
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}

/**
 * Delete a scheduled event
 */
export async function deleteScheduledEvent(eventId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)

  if (error) throw error
}

/**
 * Get optimal posting times based on platform
 */
export function getOptimalPostingTimes(platform: string): string[] {
  // Based on industry research, here are optimal posting times by platform
  const optimalTimes: Record<string, string[]> = {
    linkedin: ['08:00', '12:00', '17:00'], // Morning, noon, early evening
    instagram: ['06:00', '11:00', '19:00', '22:00'], // Early morning, late morning, evening
    x: ['08:00', '10:00', '13:00', '15:00', '17:00'], // Multiple times throughout day
    facebook: ['13:00', '19:00', '20:00', '21:00'], // Afternoon and evening
    youtube: ['14:00', '16:00', '20:00'], // Afternoon and evening
    tiktok: ['06:00', '10:00', '19:00', '23:00'], // Early morning, late morning, evening, late night
  }

  return optimalTimes[platform.toLowerCase()] || ['12:00'] // Default to noon
}

/**
 * Suggest optimal posting times based on platform and timezone
 */
export function suggestOptimalPostingTimes(
  platform: string,
  timezone = 'UTC'
): Array<{ time: string; platformName: string }> {
  const times = getOptimalPostingTimes(platform)

  // In a real implementation, you would convert times based on timezone
  // For now, just return the base times
  return times.map(time => ({
    time,
    platformName: platform,
  }))
}

/**
 * Schedule a post for a specific time
 */
export async function schedulePost(
  postId: string,
  scheduledTime: string,
  timezone = 'UTC'
): Promise<CalendarEvent> {
  const supabase = await createClient()

  // Create a calendar event for the scheduled post
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: user.id,
      post_id: postId,
      title: 'Scheduled Post',
      event_date: scheduledTime,
      timezone,
      event_type: 'post',
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}
