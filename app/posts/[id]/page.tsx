"use client"
import PostDetail from "@/components/posts/post-detail"

const PostDetailPage = ({ params }: { params: { id: string } }) => {
  return (
    <main className="flex min-h-screen flex-col p-4 sm:p-8">
      <PostDetail postId={params.id} />
    </main>
  )
}

export default PostDetailPage