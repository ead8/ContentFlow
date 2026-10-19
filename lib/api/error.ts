import { NextResponse } from 'next/server'

/** Invalid client input; reported as HTTP 400 with its message */
export class ValidationError extends Error {
  name = 'ValidationError'
}

/** Messages that are safe to show to the client, with their HTTP status */
const KNOWN_ERRORS: Record<string, number> = {
  'User not authenticated': 401,
  'Insufficient credits': 402,
  'Post not found': 404,
  'Event not found': 404,
}

/**
 * Build a JSON error response for API routes.
 * Known/validation errors are returned as-is with the right status code;
 * anything else is logged and reported as a generic 500 so database or
 * provider internals are not leaked to the browser.
 */
export function apiError(error: unknown, context: string): NextResponse {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Unknown error'

  const isValidation = error instanceof ValidationError
  const status = isValidation ? 400 : KNOWN_ERRORS[message]

  if (status) {
    return NextResponse.json({ success: false, error: message }, { status })
  }

  // Messages we raise ourselves for user-facing failures (AI provider down etc.)
  if (error instanceof Error && /Please try again\.$|not configured/.test(message)) {
    console.error(`${context}:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }

  console.error(`${context}:`, error)
  return NextResponse.json(
    { success: false, error: 'Something went wrong. Please try again.' },
    { status: 500 }
  )
}
