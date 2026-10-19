import { CreditSummary, fetchCreditUsage } from '@/lib/n8n/client'

/**
 * Poll the credit wallet until the balance differs from `previousCredits`
 * (e.g. after a generation that is charged asynchronously).
 */
export async function waitForCreditUpdate(
  previousCredits: number,
  {
    getCredits = fetchCreditUsage,
    timeoutMs = 20000,
    intervalMs = 500,
  }: { getCredits?: () => Promise<CreditSummary>; timeoutMs?: number; intervalMs?: number } = {}
): Promise<CreditSummary> {
  const start = Date.now()

  /* eslint-disable no-await-in-loop */
  while (Date.now() - start < timeoutMs) {
    const latest = await getCredits()
    if (latest && latest.credits !== previousCredits) return latest
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Timed out waiting for credit update')
}
