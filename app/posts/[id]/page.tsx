import { Suspense } from "react"
import PostDetail from "@/components/posts/post-detail"

export const metadata = { title: "Post" }

export default function PostDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Suspense>
        <PostDetail postId={params.id} />
      </Suspense>
    </div>
  )
}
