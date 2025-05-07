"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Calendar, ThumbsUp, MessageSquare, Users, ExternalLink } from "lucide-react"

export function PostPerformanceOverview() {
  const recentPosts = [
    {
      id: 1,
      platform: "linkedin",
      title: "Announcing our latest AI feature release",
      status: "posted",
      date: new Date(),
      engagement: {
        likes: 245,
        comments: 32,
        reach: 12500
      },
      thumbnail: "https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg"
    },
    {
      id: 2,
      platform: "instagram",
      title: "Behind the scenes at our office",
      status: "scheduled",
      date: new Date(Date.now() + 86400000),
      thumbnail: "https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg"
    },
    {
      id: 3,
      platform: "twitter",
      title: "Quick tip about productivity",
      status: "draft",
      date: new Date(Date.now() - 86400000),
      engagement: {
        likes: 89,
        comments: 12,
        reach: 3400
      },
      thumbnail: "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg"
    }
  ]

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
            {recentPosts.map((post) => (
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
                      {format(post.date, "MMM d, yyyy")}
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