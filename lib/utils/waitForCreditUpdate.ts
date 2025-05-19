import { CreditUsage } from "@/models/user"

// utils/waitForCreditUpdate.ts
export async function waitForCreditUpdate(
  getCredits: () => Promise<CreditUsage>,
  previousUpdatedAt: number,          // timestamp from before the mutation
  { timeoutMs = 20000, intervalMs = 100 } = {}
): Promise<CreditUsage> {
  const start = Date.now()

  /* eslint-disable no-await-in-loop */
  while (Date.now() - start < timeoutMs) {
    const latest = await getCredits()
    if (latest && latest.image_credits_used !== previousUpdatedAt) return latest
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Timed out waiting for credit update')
}
