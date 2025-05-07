"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Textarea, 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input, 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { Loader2, Image as ImageIcon, PencilLine, Video } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"

const contentFormSchema = z.object({
  platform: z.enum(["linkedin", "instagram", "twitter", "youtube"]),
  prompt: z.string().min(5, {
    message: "Prompt must be at least 5 characters.",
  }),
  tone: z.enum(["professional", "casual", "enthusiastic", "informative"]),
  audience: z.string().optional(),
})

const imageFormSchema = z.object({
  prompt: z.string().min(5, {
    message: "Prompt must be at least 5 characters.",
  }),
  style: z.enum(["realistic", "abstract", "cartoon", "sketch", "watercolor"]),
  aspect: z.enum(["1:1", "16:9", "4:3", "9:16"]),
})

const videoFormSchema = z.object({
  prompt: z.string().min(5, {
    message: "Prompt must be at least 5 characters.",
  }),
  style: z.enum(["realistic", "animated", "cinematic", "vlog", "documentary"]),
  duration: z.enum(["15s", "30s", "60s", "3min"]),
})

export default function GeneratePage() {
  const { toast } = useToast()
  const [isGeneratingText, setIsGeneratingText] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  
  const contentForm = useForm<z.infer<typeof contentFormSchema>>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      platform: "linkedin",
      prompt: "",
      tone: "professional",
      audience: "",
    },
  })
  
  const imageForm = useForm<z.infer<typeof imageFormSchema>>({
    resolver: zodResolver(imageFormSchema),
    defaultValues: {
      prompt: "",
      style: "realistic",
      aspect: "1:1",
    },
  })
  
  const videoForm = useForm<z.infer<typeof videoFormSchema>>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      prompt: "",
      style: "realistic",
      duration: "30s",
    },
  })

  const onContentSubmit = async (values: z.infer<typeof contentFormSchema>) => {
    setIsGeneratingText(true)
    setGeneratedContent(null)
    
    // Simulate API call
    try {
      // In a real app, this would be an API call to a GPT service
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock generated content based on form values
      const mockContent = `Here's your ${values.tone} ${values.platform} post:

${values.platform === "linkedin" 
  ? "Excited to share that our team has made significant progress on our latest project. The results have been exceptional, and I'm proud of everyone's hard work and dedication. #Innovation #TeamWork" 
  : values.platform === "instagram"
  ? "✨ Sometimes the best moments happen when you least expect them. Grateful for this amazing journey and all the people who make it special. What are you grateful for today? #Blessed #LiveAuthentic"
  : values.platform === "twitter"
  ? "Just launched our new feature and the feedback has been incredible! Thanks to everyone who's trying it out. Would love to hear your thoughts! 🚀"
  : "In today's video, we're diving deep into industry trends and sharing our expert insights. Like and subscribe for more content like this!"}

This content was generated based on your prompt: "${values.prompt}"
Audience: ${values.audience || "General"}
`;
      
      setGeneratedContent(mockContent)
      toast({
        title: "Content generated",
        description: "Your content has been successfully generated.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "There was an error generating your content.",
      })
    } finally {
      setIsGeneratingText(false)
    }
  }
  
  const onImageSubmit = async (values: z.infer<typeof imageFormSchema>) => {
    setIsGeneratingImage(true)
    
    // Simulate API call
    try {
      // In a real app, this would be an API call to an image generation service
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      toast({
        title: "Image generated",
        description: "Your image has been successfully generated and added to your media library.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "There was an error generating your image.",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }
  
  const onVideoSubmit = async (values: z.infer<typeof videoFormSchema>) => {
    setIsGeneratingVideo(true)
    
    // Simulate API call
    try {
      // In a real app, this would be an API call to a video generation service
      await new Promise(resolve => setTimeout(resolve, 4000))
      
      toast({
        title: "Video generation started",
        description: "Your video is being generated. You'll be notified when it's ready.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "There was an error starting your video generation.",
      })
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Generate Content</h2>
      </div>
      
      <Tabs defaultValue="text" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text">
            <PencilLine className="h-4 w-4 mr-2" />
            Text
          </TabsTrigger>
          <TabsTrigger value="image">
            <ImageIcon className="h-4 w-4 mr-2" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="h-4 w-4 mr-2" />
            Video
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Form {...contentForm}>
                <form onSubmit={contentForm.handleSubmit(onContentSubmit)} className="space-y-4">
                  <FormField
                    control={contentForm.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Platform</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={contentForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Write a post about our new product launch..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={contentForm.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tone</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select tone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                              <SelectItem value="informative">Informative</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={contentForm.control}
                      name="audience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Audience (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Marketing professionals" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isGeneratingText}
                  >
                    {isGeneratingText ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Content"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          {generatedContent && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-sm font-medium">Generated Content</div>
                  <div className="whitespace-pre-wrap rounded-md bg-muted p-4">
                    {generatedContent}
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedContent)}>
                      Copy
                    </Button>
                    <Button>
                      Save to Drafts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Form {...imageForm}>
                <form onSubmit={imageForm.handleSubmit(onImageSubmit)} className="space-y-4">
                  <FormField
                    control={imageForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A serene mountain landscape at sunset with dramatic clouds..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={imageForm.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Style</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="realistic">Realistic</SelectItem>
                              <SelectItem value="abstract">Abstract</SelectItem>
                              <SelectItem value="cartoon">Cartoon</SelectItem>
                              <SelectItem value="sketch">Sketch</SelectItem>
                              <SelectItem value="watercolor">Watercolor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={imageForm.control}
                      name="aspect"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aspect Ratio</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select aspect ratio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1:1">Square (1:1)</SelectItem>
                              <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                              <SelectItem value="4:3">Landscape (4:3)</SelectItem>
                              <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isGeneratingImage}
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Image...
                      </>
                    ) : (
                      "Generate Image"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="video" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Form {...videoForm}>
                <form onSubmit={videoForm.handleSubmit(onVideoSubmit)} className="space-y-4">
                  <FormField
                    control={videoForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A product showcase demonstrating features with smooth transitions..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={videoForm.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Style</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="realistic">Realistic</SelectItem>
                              <SelectItem value="animated">Animated</SelectItem>
                              <SelectItem value="cinematic">Cinematic</SelectItem>
                              <SelectItem value="vlog">Vlog</SelectItem>
                              <SelectItem value="documentary">Documentary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={videoForm.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="15s">15 seconds</SelectItem>
                              <SelectItem value="30s">30 seconds</SelectItem>
                              <SelectItem value="60s">1 minute</SelectItem>
                              <SelectItem value="3min">3 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <p>Note: Video generation may take several minutes depending on complexity.</p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isGeneratingVideo}
                  >
                    {isGeneratingVideo ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Generate Video"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}