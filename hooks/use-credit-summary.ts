"use client"

import { useCallback, useEffect, useState } from "react"
import { CREDITS_CHANGED_EVENT, CreditSummary, fetchCreditUsage } from "@/lib/n8n/client"

// Several components (header badge, dashboard tracker, generation steps)
// mount at once and all refetch on the same event; share one request.
let inFlight: Promise<CreditSummary> | null = null

function loadSummary(): Promise<CreditSummary> {
  if (!inFlight) {
    inFlight = fetchCreditUsage().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/**
 * The user's credit wallet from GET /api/dashboard/credits. Refetches when a
 * `credits:changed` window event is dispatched (see notifyCreditsChanged()).
 */
export function useCreditSummary() {
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async (): Promise<CreditSummary | null> => {
    setIsLoading(true)
    try {
      const data = await loadSummary()
      setSummary(data)
      setError(null)
      return data
    } catch (err) {
      console.error("Failed to load credit balance:", err)
      setError(err instanceof Error ? err : new Error("Failed to load credits"))
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onChange = () => {
      refresh()
    }
    window.addEventListener(CREDITS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onChange)
  }, [refresh])

  return { summary, isLoading, error, refresh }
}

/** Percentage of the monthly allowance still available (0-100) */
export function percentRemaining(summary: CreditSummary): number {
  if (summary.monthly_allowance <= 0) return summary.credits > 0 ? 100 : 0
  return Math.max(0, Math.min(100, Math.round((summary.credits / summary.monthly_allowance) * 100)))
}

export function formatRefreshDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
