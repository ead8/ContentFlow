"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  Eye,
  Filter,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  MoreHorizontal,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Facebook,
  X,
} from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

// Define the Post type based on the provided data structure
interface Post {
  id: number
  user_id: string
  topic: string
  platform: string[]
  status: "draft" | "published" | "scheduled"
  created_at: string
}

// Sample data for demonstration - expanded for pagination
const samplePosts: Post[] = [
  {
    id: 15,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Write about AI in Health Care",
    platform: ["linkedin", "instagram", "youtube", "twitter"],
    status: "draft",
    created_at: "2025-05-14T11:23:50.821385+00:00",
  },
  {
    id: 16,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "The Future of Remote Work",
    platform: ["linkedin", "twitter"],
    status: "published",
    created_at: "2025-05-13T09:15:30.821385+00:00",
  },
  {
    id: 17,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Sustainable Technology Practices",
    platform: ["linkedin", "instagram"],
    status: "scheduled",
    created_at: "2025-05-12T14:45:20.821385+00:00",
  },
  {
    id: 18,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Blockchain in Supply Chain Management",
    platform: ["linkedin", "youtube"],
    status: "draft",
    created_at: "2025-05-11T16:30:10.821385+00:00",
  },
  {
    id: 19,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Cybersecurity Best Practices for Small Businesses",
    platform: ["linkedin", "twitter", "instagram"],
    status: "published",
    created_at: "2025-05-10T10:20:45.821385+00:00",
  },
  {
    id: 20,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Machine Learning for Beginners",
    platform: ["linkedin", "youtube"],
    status: "draft",
    created_at: "2025-05-09T08:15:30.821385+00:00",
  },
  {
    id: 21,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Digital Marketing Trends 2025",
    platform: ["instagram", "twitter"],
    status: "scheduled",
    created_at: "2025-05-08T13:40:20.821385+00:00",
  },
  {
    id: 22,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "NFTs and the Future of Digital Ownership",
    platform: ["linkedin", "twitter", "youtube"],
    status: "published",
    created_at: "2025-05-07T15:25:10.821385+00:00",
  },
  {
    id: 23,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Building a Personal Brand Online",
    platform: ["linkedin", "instagram"],
    status: "draft",
    created_at: "2025-05-06T09:10:45.821385+00:00",
  },
  {
    id: 24,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "The Ethics of Artificial Intelligence",
    platform: ["linkedin", "twitter", "youtube"],
    status: "scheduled",
    created_at: "2025-05-05T11:35:30.821385+00:00",
  },
  {
    id: 25,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Cloud Computing for Small Businesses",
    platform: ["linkedin"],
    status: "published",
    created_at: "2025-05-04T14:50:20.821385+00:00",
  },
  {
    id: 26,
    user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
    topic: "Social Media Strategy for Startups",
    platform: ["instagram", "twitter"],
    status: "draft",
    created_at: "2025-05-03T16:15:10.821385+00:00",
  },
]

const PostsTable = () => {
  const router = useRouter()  
  const [posts] = useState<Post[]>(samplePosts)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // Filter posts based on search query and status filter
  const filteredPosts = posts.filter((post) => {
    const matchesSearch = post.topic.toLowerCase().includes(searchQuery.toLowerCase())
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
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const goToPreviousPage = () => {
    goToPage(currentPage - 1)
  }

  const goToNextPage = () => {
    goToPage(currentPage + 1)
  }

  const handleViewDetail = (postId: number) => {
    // Navigate to detail page or open modal
    router.push(`/posts/${postId}`)
  }

  // Platform icon mapping
  const PlatformIcon = ({ platform }: { platform: string }) => {
    switch (platform) {
      case "linkedin":
        return <Linkedin className="h-4 w-4 text-blue-600" />
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-600" />
      case "youtube":
        return <Youtube className="h-4 w-4 text-red-600" />
      case "twitter":
        return <Twitter className="h-4 w-4 text-sky-500" />
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-700" />
      default:
        return null
    }
  }

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            Draft
          </Badge>
        )
      case "published":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Published
          </Badge>
        )
      case "scheduled":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Scheduled
          </Badge>
        )
      default:
        return null
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always show first page
      pageNumbers.push(1)

      // Calculate start and end of visible page range
      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4)
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3)
      }

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push("ellipsis-start")
      }

      // Add visible page numbers
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push("ellipsis-end")
      }

      // Always show last page
      if (totalPages > 1) {
        pageNumbers.push(totalPages)
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
                type="text"
                placeholder="Search posts..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead className="hidden md:table-cell">Platforms</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.length > 0 ? (
                currentItems.map((post) => (
                  <TableRow key={post.id} className="group">
                    <TableCell className="font-medium">{post.id}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium">{post.topic}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex space-x-1">
                        {post.platform.map((platform) => (
                          <div
                            key={platform}
                            className="rounded-full p-1 bg-gray-100 group-hover:bg-gray-200 transition-colors"
                            title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                          >
                            <PlatformIcon platform={platform} />
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3" />
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        {/* <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetail(post.id)}
                          className="text-gray-700 hover:text-primary hover:bg-gray-100"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View details</span>
                        </Button> */}
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
                              {/* <Eye className="mr-2 h-4 w-4" /> */}
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit post</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">Delete post</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No posts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{endIndex} of {totalItems} posts
            </div>

            <div className="flex items-center space-x-2">
              {/* Items per page selector */}
              <div className="flex items-center space-x-2 mr-4">
                <span className="text-sm text-gray-500">Show</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1) // Reset to first page when changing items per page
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>

                {/* Page numbers */}
                <div className="hidden sm:flex items-center space-x-1">
                  {getPageNumbers().map((pageNumber, index) =>
                    pageNumber === "ellipsis-start" || pageNumber === "ellipsis-end" ? (
                      <div key={`ellipsis-${index}`} className="px-2">
                        ...
                      </div>
                    ) : (
                      <Button
                        key={`page-${pageNumber}`}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToPage(Number(pageNumber))}
                      >
                        {pageNumber}
                      </Button>
                    ),
                  )}
                </div>

                {/* Mobile page indicator */}
                <div className="sm:hidden px-2">
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PostsTable