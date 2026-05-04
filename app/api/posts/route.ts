import { NextRequest, NextResponse } from 'next/server'
import { createPost, getUserPosts, updatePost, deletePost, publishPost } from '@/lib/services/content-posts'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const posts = await getUserPosts(status || undefined, limit, offset)
    return NextResponse.json({ success: true, data: posts })
  } catch (error: any) {
    console.error('[v0] Error fetching posts:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, title, media_urls, tone, language, scheduled_for, generated_by_ai, credits_used } = body

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    const post = await createPost(content, {
      title,
      media_urls,
      tone,
      language,
      scheduled_for,
      generated_by_ai,
      credits_used,
    })

    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error: any) {
    console.error('[v0] Error creating post:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, ...updates } = body

    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'Post ID required' },
        { status: 400 }
      )
    }

    const post = await updatePost(postId, updates)
    return NextResponse.json({ success: true, data: post })
  } catch (error: any) {
    console.error('[v0] Error updating post:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
