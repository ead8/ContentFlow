import { NextRequest, NextResponse } from 'next/server'
import {
  getUserCredits,
  deductCredits,
  addCredits,
  getCreditTransactions,
  refillCredits,
} from '@/lib/services/credits'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'balance' or 'transactions'

    if (type === 'transactions') {
      const limit = parseInt(searchParams.get('limit') || '50')
      const transactions = await getCreditTransactions(limit)
      return NextResponse.json({ success: true, data: transactions })
    } else {
      const credits = await getUserCredits()
      return NextResponse.json({ success: true, data: credits })
    }
  } catch (error: any) {
    console.error('[v0] Error fetching credits:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, amount, description, referenceId } = body

    if (!action || !amount) {
      return NextResponse.json(
        { success: false, error: 'Action and amount are required' },
        { status: 400 }
      )
    }

    let result

    if (action === 'deduct') {
      result = await deductCredits(amount, description, referenceId)
    } else if (action === 'add') {
      result = await addCredits(amount, description, referenceId)
    } else if (action === 'refill') {
      await refillCredits(amount, description)
      return NextResponse.json({ success: true }, { status: 201 })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error: any) {
    console.error('[v0] Error processing credits:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
