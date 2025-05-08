"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Calendar, ThumbsUp, MessageSquare, Users, ExternalLink } from "lucide-react"
import { fetchPostPerformance } from "@/lib/n8n/client"

interface PostEngagement {
  likes: number;
  comments: number;
  reach: number;
}

interface Post {
  id: string;
  thumbnail: string;
  title: string;
  status: "posted" | "scheduled" | "draft";
  platform: string;
  date: string;
  engagement?: PostEngagement;
}

export function PostPerformanceOverview() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await fetchPostPerformance()
        setPosts(data)
      } catch (error) {
        console.error('Failed to load post performance:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPosts()
  }, [])

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Post Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="recent" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recent">Recent Posts</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="recent" className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className="w-20 h-20 rounded-md overflow-hidden">
                  <img 
                    src={post.thumbnail} 
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={
                      post.status === "posted" ? "default" :
                      post.status === "scheduled" ? "secondary" :
                      "outline"
                    }>
                      {post.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {post.platform}
                    </Badge>
                  </div>
                  <h4 className="font-medium truncate">{post.title}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(post.date), "MMM d, yyyy")}
                    </div>
                    {post.engagement && (
                      <>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="w-4 h-4" />
                          {post.engagement.likes}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {post.engagement.comments}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {post.engagement.reach.toLocaleString()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button className="p-2 hover:bg-accent rounded-full">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="calendar">
            <div className="text-center text-muted-foreground p-4">
              Calendar view coming soon
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}