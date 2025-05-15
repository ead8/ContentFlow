"use client"
import PostDetail from "@/components/posts/post-detail"

const PostDetailPage = ({ params }: { params: { id: string } }) => {
  const postId = Number.parseInt(params.id, 10)

  return (
    <main className="flex min-h-screen flex-col p-4 sm:p-8">
      <PostDetail postId={postId} />
    </main>
  )
}

export default PostDetailPage