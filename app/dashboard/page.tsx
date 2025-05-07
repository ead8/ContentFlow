import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, BarChart4, CalendarDays, Image, PencilLine, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/generate">
              Create Content
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Posts
                </CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">
                  +3 from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Engagement Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5.4%</div>
                <p className="text-xs text-muted-foreground">
                  +0.2% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Media Items
                </CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">18</div>
                <p className="text-xs text-muted-foreground">
                  +5 from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Credits Used
                </CardTitle>
                <BarChart4 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">72%</div>
                <p className="text-xs text-muted-foreground">
                  36/50 credits used
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your content creation and publishing activity from the past 7 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-md border p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <PencilLine className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Created LinkedIn post</p>
                    <p className="text-xs text-muted-foreground">
                      6 hours ago
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-md border p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <Image className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Generated 3 images</p>
                    <p className="text-xs text-muted-foreground">
                      Yesterday at 2:45 PM
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-md border p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Scheduled Instagram post</p>
                    <p className="text-xs text-muted-foreground">
                      Yesterday at 10:30 AM
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                View all activity
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

async function DashboardContent() {
  const supabase = createClient()

  // Get user profile data
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  if (!userId) {
    return <div>Please log in to view your dashboard</div>
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Would normally fetch real stats here
  const postsCount = 0
  const mediaCount = 0
  const creditsRemaining = profile?.credits || 50
  const creditsTotal = profile?.role === 'free' ? 50 : 
                        profile?.role === 'creator' ? 150 :
                        profile?.role === 'pro' ? 300 :
                        profile?.role === 'agency' ? 1000 : 3000

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Posts
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{postsCount}</div>
            <p className="text-xs text-muted-foreground">
              Publish to grow your presence
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Media Items
            </CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mediaCount}</div>
            <p className="text-xs text-muted-foreground">
              Images and videos in your library
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Credits
            </CardTitle>
            <BarChart4 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditsRemaining}</div>
            <p className="text-xs text-muted-foreground">
              of {creditsTotal} total credits
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Plan
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{profile?.role || "Free"}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/settings" className="text-primary hover:underline">
                Upgrade your plan
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with content creation and management
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild>
              <Link href="/generate">
                <PencilLine className="mr-2 h-4 w-4" />
                Create new content
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/media">
                <Image className="mr-2 h-4 w-4" />
                Browse media library
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/posts">
                <CalendarDays className="mr-2 h-4 w-4" />
                Manage scheduled posts
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Welcome to Intuity Sync</CardTitle>
            <CardDescription>
              Your AI-powered social media automation platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Intuity Sync helps you create, schedule, and publish engaging 
                content across multiple platforms using AI. Get started by:
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Generating content using our AI tools</li>
                <li>Creating images and videos to accompany your posts</li>
                <li>Scheduling content across different platforms</li>
                <li>Tracking performance with our analytics tools</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tutorial">
                View Tutorial
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}