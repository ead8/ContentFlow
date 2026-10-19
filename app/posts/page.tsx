import { Suspense } from "react"
import PostsTable from "@/components/posts/post-table"

export const metadata = { title: "My Posts" }

export default function PostsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Suspense>
        <PostsTable />
      </Suspense>
    </div>
  )
}
