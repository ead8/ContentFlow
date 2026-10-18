import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarEvents,
  getUpcomingEvents,
  createScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
  getOptimalPostingTimes,
} from '@/lib/services/scheduling'
import { apiError } from '@/lib/api/error'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'upcoming', 'range', or 'optimal-times'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const platform = searchParams.get('platform')
    const days = parseInt(searchParams.get('days') || '7')

    if (type === 'optimal-times' && platform) {
      const times = getOptimalPostingTimes(platform)
      return NextResponse.json({ success: true, data: times })
    } else if (type === 'upcoming') {
      const events = await getUpcomingEvents(days)
      return NextResponse.json({ success: true, data: events })
    } else if (type === 'range' && startDate && endDate) {
      const events = await getCalendarEvents(startDate, endDate)
      return NextResponse.json({ success: true, data: events })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }
  } catch (error) {
    return apiError(error, 'Error fetching calendar events')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, eventDate, postId, description, timezone, eventType } = body

    if (!title || !eventDate) {
      return NextResponse.json(
        { success: false, error: 'Title and event date are required' },
        { status: 400 }
      )
    }

    const event = await createScheduledEvent(title, eventDate, {
      postId,
      description,
      timezone,
      eventType,
    })

    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Error creating scheduled event')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, ...updates } = body

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID required' },
        { status: 400 }
      )
    }

    const event = await updateScheduledEvent(eventId, updates)
    return NextResponse.json({ success: true, data: event })
  } catch (error) {
    return apiError(error, 'Error updating scheduled event')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID required' },
        { status: 400 }
      )
    }

    await deleteScheduledEvent(eventId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error deleting scheduled event')
  }
}
