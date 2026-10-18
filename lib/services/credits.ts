import { createClient } from '@/lib/supabase/server'

export interface UserCredits {
  user_id: string
  available_credits: number
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: string
  description: string | null
  reference_id: string | null
  balance_after: number | null
  created_at: string
}

async function getAuthedUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')
  return user.id
}

async function readWallet(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data?.credits ?? 0
}

/**
 * Initialize credits for a new user. Profiles are created with a default
 * credit balance by the database, so this just ensures a row exists.
 */
export async function initializeUserCredits(userId: string, initialCredits = 50): Promise<UserCredits> {
  const supabase = await createClient()

  await supabase
    .from('profiles')
    .update({ credits: initialCredits })
    .eq('id', userId)

  return { user_id: userId, available_credits: initialCredits }
}

/**
 * Get the current user's credit balance (single source of truth:
 * profiles.credits)
 */
export async function getUserCredits(): Promise<UserCredits> {
  const userId = await getAuthedUserId()
  const available_credits = await readWallet(userId)
  return { user_id: userId, available_credits }
}

/**
 * Deduct credits from the user's wallet and record the transaction
 */
export async function deductCredits(
  amount: number,
  description?: string,
  referenceId?: string
): Promise<CreditTransaction> {
  if (amount <= 0) throw new Error('Amount must be positive')

  const supabase = await createClient()
  const userId = await getAuthedUserId()
  const current = await readWallet(userId)

  if (current < amount) {
    throw new Error('Insufficient credits')
  }

  const newBalance = current - amount

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) throw updateError

  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: -amount,
      transaction_type: 'deduction',
      description,
      reference_id: referenceId,
      balance_after: newBalance,
    })
    .select()
    .single()

  if (error) throw error
  return data as CreditTransaction
}

/**
 * Add credits to the user's wallet and record the transaction
 */
export async function addCredits(
  amount: number,
  description?: string,
  referenceId?: string
): Promise<CreditTransaction> {
  if (amount <= 0) throw new Error('Amount must be positive')

  const supabase = await createClient()
  const userId = await getAuthedUserId()
  const current = await readWallet(userId)
  const newBalance = current + amount

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) throw updateError

  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount,
      transaction_type: 'addition',
      description,
      reference_id: referenceId,
      balance_after: newBalance,
    })
    .select()
    .single()

  if (error) throw error
  return data as CreditTransaction
}

/**
 * Get credit transaction history
 */
export async function getCreditTransactions(limit = 50): Promise<CreditTransaction[]> {
  const supabase = await createClient()
  const userId = await getAuthedUserId()

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as CreditTransaction[]
}

/**
 * Refill credits (e.g. monthly plan refill)
 */
export async function refillCredits(amount: number, description = 'Monthly refill'): Promise<void> {
  await addCredits(amount, description, 'refill')
}
