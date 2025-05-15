"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  ExternalLink,
  Hash,
  MessageSquare,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// Define the platform-specific content type
interface PlatformContent {
  text: string
  callToAction?: string
  hashtags: string[]
  image?: string
  video?: string
}

// Define the Post type with platform-specific content
interface PostDetail {
  id: number
  user_id: string
  title: string
  status: "draft" | "published" | "scheduled"
  created_at: string
  scheduled_at?: string
  platforms: {
    linkedin?: PlatformContent
    twitter?: PlatformContent
    instagram?: PlatformContent
    youtube?: PlatformContent
  }
}

// Sample post data
const samplePost: PostDetail = {
  id: 15,
  user_id: "f06be5f6-d7e9-437d-8b1e-cbdcd7293975",
  title: "AI in Health Care",
  status: "scheduled",
  created_at: "2025-05-14T11:23:50.821385+00:00",
  scheduled_at: "2025-05-20T09:00:00.000000+00:00",
  platforms: {
    linkedin: {
      text: "Artificial Intelligence is revolutionizing healthcare in unprecedented ways. From diagnostic tools to personalized treatment plans, AI is helping medical professionals make better decisions faster.\n\nAt our company, we're developing cutting-edge AI solutions that help hospitals reduce wait times and improve patient outcomes. Our recent case study with Metro Hospital showed a 35% reduction in diagnostic errors.",
      callToAction:
        "Read our full case study on AI in healthcare to learn more about how we're transforming patient care.",
      hashtags: ["HealthcareAI", "MedTech", "AIInnovation", "PatientCare", "HealthTech"],
      image: "/placeholder.svg?height=400&width=600",
    },
    twitter: {
      text: "AI is changing healthcare for the better! Our new tools have helped reduce diagnostic errors by 35% at Metro Hospital.",
      hashtags: ["HealthcareAI", "MedTech", "AIInnovation"],
      image: "/placeholder.svg?height=300&width=600",
    },
    instagram: {
      text: "The future of healthcare is here. AI is helping doctors make better decisions and improving patient outcomes. Swipe to see how our technology is making a difference.",
      hashtags: ["HealthcareAI", "MedTech", "AIInnovation", "HealthTech", "FutureTech", "MedicalInnovation"],
      image: "/placeholder.svg?height=600&width=600",
    },
    youtube: {
      text: "How Artificial Intelligence is Transforming Healthcare | Our Latest Case Study",
      callToAction: "Subscribe to our channel for more insights on AI in healthcare and other industries.",
      hashtags: ["HealthcareAI", "MedTech", "AIInnovation"],
      video: "/placeholder.svg?height=400&width=700",
    },
  },
}

// Platform icon mapping
const PlatformIcon = ({ platform }: { platform: string }) => {
  switch (platform) {
    case "linkedin":
      return <Linkedin className="h-5 w-5 text-blue-600" />
    case "instagram":
      return <Instagram className="h-5 w-5 text-pink-600" />
    case "youtube":
      return <Youtube className="h-5 w-5 text-red-600" />
    case "twitter":
      return <Twitter className="h-5 w-5 text-sky-500" />
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

const PostDetail = ({ postId }: { postId?: number }) => {
  // In a real app, you would fetch the post data based on the postId
  const post = samplePost
  const router = useRouter()

  // Get available platforms
  const availablePlatforms = Object.keys(post.platforms) as Array<keyof typeof post.platforms>
  const [activeTab, setActiveTab] = useState<string>(availablePlatforms[0] || "linkedin")

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBack} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Posts
          </Button>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <h1 className="text-2xl font-bold">{post.title}</h1>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(post.status)}
          <Button variant="outline" className="hidden sm:flex">
            <ExternalLink className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button>Edit Post</Button>
        </div>
      </div>

      {/* Post metadata card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Post Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Post ID</div>
              <div>{post.id}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Status</div>
              <div>{getStatusBadge(post.status)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-500">Created At</div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                {format(new Date(post.created_at), "MMMM d, yyyy")}
                <Clock className="h-4 w-4 ml-3 mr-1 text-gray-500" />
                {format(new Date(post.created_at), "h:mm a")}
              </div>
            </div>
            {post.scheduled_at && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-500">Scheduled For</div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                  {format(new Date(post.scheduled_at), "MMMM d, yyyy")}
                  <Clock className="h-4 w-4 ml-3 mr-1 text-gray-500" />
                  {format(new Date(post.scheduled_at), "h:mm a")}
                </div>
              </div>
            )}
            <div className="space-y-1 md:col-span-2">
              <div className="text-sm font-medium text-gray-500">Platforms</div>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <Badge key={platform} variant="outline" className="flex items-center gap-1 px-4 py-2">
                    <PlatformIcon platform={platform} />
                    <span className="capitalize">{platform}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform-specific content tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Platform Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              {availablePlatforms.map((platform) => (
                <TabsTrigger key={platform} value={platform} className="flex items-center gap-2">
                  <PlatformIcon platform={platform} />
                  <span className="capitalize">{platform}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {availablePlatforms.map((platform) => {
              const content = post.platforms[platform]
              if (!content) return null

              return (
                <TabsContent key={platform} value={platform} className="space-y-6">
                  {/* Content section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Content
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap">{content.text}</div>

                    {/* Call to action */}
                    {content.callToAction && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Call to Action</h4>
                        <div className="bg-blue-50 p-4 rounded-md border-l-4 border-blue-500">
                          {content.callToAction}
                        </div>
                      </div>
                    )}

                    {/* Hashtags */}
                    {content.hashtags && content.hashtags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                          <Hash className="h-4 w-4 mr-1" />
                          Hashtags
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {content.hashtags.map((tag) => (
                            <Badge key={tag} variant="outline" className="bg-gray-100">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Media section */}
                  <div className="space-y-4">
                    {content.image && (
                      <div>
                        <h3 className="text-lg font-medium mb-3">Image</h3>
                        <div className="bg-gray-100 rounded-md p-2 flex justify-center">
                          <img
                            src={content.image || "/placeholder.svg"}
                            alt={`${platform} post image`}
                            className="max-h-[400px] rounded-md object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {content.video && (
                      <div>
                        <h3 className="text-lg font-medium mb-3">Video</h3>
                        <div className="bg-gray-100 rounded-md p-2 flex justify-center">
                          <div className="relative w-full aspect-video max-w-3xl">
                            <img
                              src={content.video || "/placeholder.svg"}
                              alt={`${platform} post video`}
                              className="w-full h-full rounded-md object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-black bg-opacity-60 rounded-full p-4">
                                <svg
                                  className="w-8 h-8 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default PostDetail