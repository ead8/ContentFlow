import { createClient } from '@/lib/supabase/server'
import { CREDIT_COSTS, CreditKind, getPlan } from '@/lib/billing/plans'

export interface CreditBalance {
  credits: number
  plan: string
  plan_name: string
  monthly_allowance: number
  credits_refreshed_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: string
  kind: string | null
  description: string | null
  reference_id: string | null
  balance_after: number | null
  created_at: string
}

/** Map Postgres errors raised by the credit functions to app errors */
function toAppError(error: { message?: string; code?: string }): Error {
  if (error.message?.includes('Insufficient credits')) return new Error('Insufficient credits')
  if (error.message?.includes('User not authenticated') || error.code === '28000') {
    return new Error('User not authenticated')
  }
  return new Error(error.message || 'Credit operation failed')
}

/**
 * Current user's balance and plan. Applies the free plan's monthly top-up.
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_my_credits').single()

  if (error) throw toAppError(error)
  const row = data as Omit<CreditBalance, 'plan_name'>
  return { ...row, plan_name: getPlan(row.plan).name }
}

/**
 * Throw 'Insufficient credits' before doing expensive work the user
 * cannot pay for. The real charge happens atomically in spendCredits().
 */
export async function assertCanAfford(kind: CreditKind): Promise<void> {
  const { credits } = await getCreditBalance()
  if (credits < CREDIT_COSTS[kind]) throw new Error('Insufficient credits')
}

/**
 * Atomically deduct the cost of an operation from the current user's
 * balance and record the transaction.
 */
export async function spendCredits(kind: CreditKind, description: string): Promise<CreditTransaction> {
  const supabase = createClient()
  const { data, error } = await supabase
    .rpc('spend_credits', {
      p_amount: CREDIT_COSTS[kind],
      p_kind: kind,
      p_description: description,
    })
    .single()

  if (error) throw toAppError(error)
  return data as CreditTransaction
}

/**
 * Credit transaction history for the current user (newest first).
 */
export async function getCreditTransactions(limit = 50): Promise<CreditTransaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))

  if (error) throw toAppError(error)
  return data as CreditTransaction[]
}
