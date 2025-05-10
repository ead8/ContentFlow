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
import { generateContent } from "@/lib/n8n/client"
import MultiStepWizard from "@/components/generate/MultiStep"

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


  return (
    <div className="mx-auto flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        {/* <h2 className="text-3xl font-bold tracking-tight">Generate Content</h2> */}
        <MultiStepWizard/>
      </div>
      
    </div>
  )
}