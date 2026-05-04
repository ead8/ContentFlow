import { NextRequest, NextResponse } from 'next/server'
import { getUserSocialAccounts, addSocialAccount, disconnectSocialAccount } from '@/lib/services/social-accounts'

export async function GET(request: NextRequest) {
  try {
    const accounts = await getUserSocialAccounts()
    return NextResponse.json({ success: true, data: accounts })
  } catch (error: any) {
    console.error('[v0] Error fetching social accounts:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platform, accountId, accountName, accessToken, refreshToken } = body

    if (!platform || !accountId || !accountName || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const account = await addSocialAccount(
      platform,
      accountId,
      accountName,
      accessToken,
      refreshToken
    )

    return NextResponse.json({ success: true, data: account }, { status: 201 })
  } catch (error: any) {
    console.error('[v0] Error adding social account:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID required' },
        { status: 400 }
      )
    }

    await disconnectSocialAccount(accountId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[v0] Error disconnecting account:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
