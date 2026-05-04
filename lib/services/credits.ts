import { createClient } from '@/lib/supabase/server'

export interface UserCredits {
  id: string
  user_id: string
  total_credits: number
  used_credits: number
  available_credits: number
  last_refilled: string | null
  refill_date: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: string
  description: string | null
  reference_id: string | null
  balance_after: number
  created_at: string
}

/**
 * Initialize credits for new user
 */
export async function initializeUserCredits(userId: string, initialCredits = 1000): Promise<UserCredits> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      total_credits: initialCredits,
      used_credits: 0,
      available_credits: initialCredits,
    })
    .select()
    .single()

  if (error) throw error
  return data as UserCredits
}

/**
 * Get user's current credits
 */
export async function getUserCredits(): Promise<UserCredits> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) throw error
  return data as UserCredits
}

/**
 * Deduct credits from user account
 */
export async function deductCredits(
  amount: number,
  description?: string,
  referenceId?: string
): Promise<CreditTransaction> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  // Get current credits
  const credits = await getUserCredits()

  if (credits.available_credits < amount) {
    throw new Error('Insufficient credits')
  }

  const newAvailable = credits.available_credits - amount
  const newUsed = credits.used_credits + amount

  // Update credits
  await supabase
    .from('user_credits')
    .update({
      used_credits: newUsed,
      available_credits: newAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // Record transaction
  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: user.id,
      amount: -amount,
      transaction_type: 'deduction',
      description,
      reference_id: referenceId,
      balance_after: newAvailable,
    })
    .select()
    .single()

  if (error) throw error
  return data as CreditTransaction
}

/**
 * Add credits to user account
 */
export async function addCredits(
  amount: number,
  description?: string,
  referenceId?: string
): Promise<CreditTransaction> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  // Get current credits
  const credits = await getUserCredits()

  const newAvailable = credits.available_credits + amount
  const newTotal = credits.total_credits + amount

  // Update credits
  await supabase
    .from('user_credits')
    .update({
      total_credits: newTotal,
      available_credits: newAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // Record transaction
  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: user.id,
      amount,
      transaction_type: 'addition',
      description,
      reference_id: referenceId,
      balance_after: newAvailable,
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as CreditTransaction[]
}

/**
 * Refill credits (monthly or annual based on plan)
 */
export async function refillCredits(amount: number, description = 'Monthly refill'): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  await addCredits(amount, description, 'refill')

  // Update refill date
  await supabase
    .from('user_credits')
    .update({
      last_refilled: new Date().toISOString(),
      refill_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('user_id', user.id)
}
