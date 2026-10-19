import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarEvents,
  getUpcomingEvents,
  createScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
  getOptimalPostingTimes,
} from '@/lib/services/scheduling'
import { apiError, ValidationError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar?type=range&startDate=&endDate=
 * GET /api/calendar?type=upcoming&days=7
 * GET /api/calendar?type=optimal-times&platform=LinkedIn
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const platform = searchParams.get('platform')

    if (type === 'optimal-times' && platform) {
      return NextResponse.json({ success: true, data: getOptimalPostingTimes(platform) })
    }
    if (type === 'upcoming') {
      const days = parseInt(searchParams.get('days') || '7', 10) || 7
      return NextResponse.json({ success: true, data: await getUpcomingEvents(days) })
    }
    if (type === 'range' && startDate && endDate) {
      return NextResponse.json({ success: true, data: await getCalendarEvents(startDate, endDate) })
    }

    throw new ValidationError('Invalid query parameters')
  } catch (error) {
    return apiError(error, 'Error fetching calendar events')
  }
}

/** POST /api/calendar  Body: { title, eventDate, description?, eventType?, timezone?, postId? } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const event = await createScheduledEvent(body)
    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Error creating scheduled event')
  }
}

/** PUT /api/calendar  Body: { eventId, title?, description?, eventDate?, status? } */
export async function PUT(request: NextRequest) {
  try {
    const { eventId, ...updates } = await request.json().catch(() => ({}))
    if (!eventId) throw new ValidationError('Event ID required')

    const event = await updateScheduledEvent(eventId, updates)
    return NextResponse.json({ success: true, data: event })
  } catch (error) {
    return apiError(error, 'Error updating scheduled event')
  }
}

/** DELETE /api/calendar?id= */
export async function DELETE(request: NextRequest) {
  try {
    const eventId = new URL(request.url).searchParams.get('id')
    if (!eventId) throw new ValidationError('Event ID required')

    await deleteScheduledEvent(eventId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error deleting scheduled event')
  }
}
