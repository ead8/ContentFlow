"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Calendar, ThumbsUp, MessageSquare, Eye, PencilLine } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchPostPerformance, type DashboardPost } from "@/lib/api/client"
import { platformLabel } from "@/lib/platforms"

export function PostPerformanceOverview() {
  const [posts, setPosts] = useState<DashboardPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPostPerformance()
      .then(setPosts)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent posts</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/posts">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-muted-foreground">Unable to load posts: {error}</p>}
        {posts && posts.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="mb-4 text-sm text-muted-foreground">You haven&apos;t created any posts yet.</p>
            <Button asChild>
              <Link href="/generate">
                <PencilLine className="mr-2 h-4 w-4" />
                Create your first post
              </Link>
            </Button>
          </div>
        )}
        {posts?.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.thumbnail}
              alt=""
              className="h-16 w-16 shrink-0 rounded-md border object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant={post.status === "posted" ? "default" : post.status === "scheduled" ? "secondary" : "outline"}
                  className="capitalize"
                >
                  {post.status === "posted" ? "Published" : post.status}
                </Badge>
                {post.platforms.slice(0, 3).map((p) => (
                  <Badge key={p} variant="outline">{platformLabel(p)}</Badge>
                ))}
              </div>
              <h4 className="truncate font-medium">{post.title}</h4>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.date), "MMM d, yyyy")}
                </span>
                {post.engagement && (
                  <>
                    <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{post.engagement.reach.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{post.engagement.likes}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />{post.engagement.comments}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
