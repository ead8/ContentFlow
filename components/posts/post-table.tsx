"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal, PencilLine, Search } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { deletePost, fetchPosts, type Post } from "@/lib/api/client"
import { platformLabel } from "@/lib/platforms"
import { StatusBadge } from "./status-badge"

const PAGE_SIZE = 10

const PostsTable = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const q = searchParams.get("q") || ""
  const status = searchParams.get("status") || "all"

  const [posts, setPosts] = useState<Post[] | null>(null)
  const [search, setSearch] = useState(q)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setSearch(q)
    setPage(1)
    setPosts(null)
    setLoadError(null)
    fetchPosts({ q: q || undefined, status: status === "all" ? undefined : status, limit: 200 })
      .then(setPosts)
      .catch((e) => setLoadError(e.message || "Failed to load posts."))
  }, [q, status])

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`)
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setParam("q", search.trim())
  }

  const handleDelete = async (post: Post) => {
    const label = post.title || post.content.slice(0, 40)
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    try {
      setDeletingId(post.id)
      await deletePost(post.id)
      setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? null)
      toast({ title: "Post deleted" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message })
    } finally {
      setDeletingId(null)
    }
  }

  const total = posts?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = posts?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? []

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-2xl">My Posts</CardTitle>
        <Button asChild>
          <Link href="/generate">
            <PencilLine className="mr-2 h-4 w-4" />
            Create post
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={onSearch} role="search" className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search title or content, then press Enter"
              aria-label="Search posts"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Select value={status} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadError ? (
          <div className="py-12 text-center">
            <p className="mb-4 text-destructive">{loadError}</p>
            <Button variant="outline" onClick={() => router.refresh()}>Retry</Button>
          </div>
        ) : !posts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              {q || status !== "all" ? "No posts match your filters." : "No posts yet."}
            </p>
            {!q && status === "all" && (
              <Button asChild>
                <Link href="/generate">Create your first post</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="hidden md:table-cell">Platforms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.map((post) => (
                    <TableRow key={post.id} className="cursor-pointer" onClick={() => router.push(`/posts/${post.id}`)}>
                      <TableCell className="max-w-[260px]">
                        <Link
                          href={`/posts/${post.id}`}
                          className="block truncate font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {post.title || post.content.slice(0, 60)}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{post.content.slice(0, 90)}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {post.platforms.length ? post.platforms.map(platformLabel).join(", ") : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={post.status} /></TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
                        {format(new Date(post.published_at || post.scheduled_for || post.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Post actions" disabled={deletingId === post.id}>
                              {deletingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/posts/${post.id}`)}>Open</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/posts/${post.id}?edit=1`)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(post)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default PostsTable
