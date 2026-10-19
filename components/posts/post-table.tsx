"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  Filter,
  MoreHorizontal,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { ContentPost } from "@/lib/services/content-posts"
import { PostStatusBadge, POST_STATUS_FILTERS } from "@/components/posts/post-status-badge"

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

const PostsTable = () => {
  const router = useRouter()
  const { toast } = useToast()
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  const loadPostData = async () => {
    try {
      setIsDataLoading(true)
      setLoadError(null)
      const postList = await api<ContentPost[]>("/api/posts?limit=100")
      setPosts(postList)
    } catch (error: any) {
      setLoadError(error.message || "Failed to load posts.")
    } finally {
      setIsDataLoading(false)
    }
  }

  useEffect(() => {
    loadPostData()
  }, [])

  const handleDelete = async (post: ContentPost) => {
    const label = post.title || post.content.slice(0, 40)
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    try {
      setDeletingId(post.id)
      await api(`/api/posts?postId=${encodeURIComponent(post.id)}`, { method: "DELETE" })
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      toast({ title: "Post deleted" })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Could not delete the post.",
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Filter posts based on search query and status filter
  const filteredPosts = posts.filter((post) => {
    const haystack = `${post.title || ""} ${post.content}`.toLowerCase()
    const matchesSearch = haystack.includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || post.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Calculate pagination values
  const totalItems = filteredPosts.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
  const currentItems = filteredPosts.slice(startIndex, endIndex)

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, Math.max(totalPages, 1))))
  }
  const goToPreviousPage = () => goToPage(currentPage - 1)
  const goToNextPage = () => goToPage(currentPage + 1)

  const handleViewDetail = (postId: string) => {
    router.push(`/posts/${postId}`)
  }

  const getStatusBadge = (status: string) => <PostStatusBadge status={status} />

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1)
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }
    }

    return pageNumbers
  }

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold">Posts</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search posts..."
                className="pl-8 w-full sm:w-[200px]"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[170px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {POST_STATUS_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => router.push("/generate")}>New post</Button>
          </div>
        </div>
      </CardHeader>

      <div className="p-4">
        {loadError ? (
          <div className="h-24 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadPostData}>
              Retry
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Created on</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled for</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isDataLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Loading posts...
                  </TableCell>
                </TableRow>
              ) : currentItems.length > 0 ? (
                currentItems.map((post) => (
                  <TableRow key={post.id} className="group">
                    <TableCell
                      className="max-w-[220px] truncate font-medium cursor-pointer hover:underline"
                      onClick={() => handleViewDetail(post.id)}
                    >
                      {post.title || post.content.slice(0, 60)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      {post.scheduled_for ? (
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {format(new Date(post.scheduled_for), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-700 hover:text-primary hover:bg-gray-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetail(post.id)}>
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={(post.status as string) === "publishing"}
                              onClick={() => router.push(`/posts/${post.id}?edit=1`)}
                            >
                              Edit post
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              disabled={deletingId === post.id || (post.status as string) === "publishing"}
                              onClick={() => handleDelete(post)}
                            >
                              {deletingId === post.id ? "Deleting..." : "Delete post"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No posts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{endIndex} of {totalItems} posts
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 mr-4">
                <span className="text-sm text-gray-500">Show</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {getPageNumbers().map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="icon"
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              ))}

              <Button
                variant="outline"
                size="icon"
                onClick={goToNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default PostsTable
