import { NextRequest, NextResponse } from 'next/server'
import { createPost, getUserPosts, updatePost, deletePost, publishPost } from '@/lib/services/content-posts'
import { apiError } from '@/lib/api/error'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const posts = await getUserPosts(status || undefined, limit, offset)
    return NextResponse.json({ success: true, data: posts })
  } catch (error) {
    return apiError(error, 'Error fetching posts')
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
  } catch (error) {
    return apiError(error, 'Error creating post')
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
  } catch (error) {
    return apiError(error, 'Error updating post')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json(
        { success: false, error: 'Post ID required' },
        { status: 400 }
      )
    }

    await deletePost(postId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error, 'Error deleting post')
  }
}
