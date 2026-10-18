import { NextResponse } from 'next/server'

/**
 * Build a JSON error response for API routes.
 * Maps known error messages to the right HTTP status code so clients can
 * distinguish "not logged in" (401) from genuine server failures (500).
 */
export function apiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[v0] ${context}:`, message)

  const status =
    message === 'User not authenticated' ? 401
    : message === 'Insufficient credits' ? 402
    : 500

  return NextResponse.json({ success: false, error: message }, { status })
}
