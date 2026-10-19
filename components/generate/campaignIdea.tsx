'use client';

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Coins, Loader2, ThumbsDown } from "lucide-react"
import {
  Button, Card, CardContent, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea,
} from "../ui"
import { useToast } from "@/hooks/use-toast"
import { generateContent, isInsufficientCredits } from "@/lib/api/client"
import { MultiSelect } from "../multiselect"
import { ContentGenerationResponse } from "@/models/content"
import ContentPreviewComponent from "./generatedContentPreview"
import { WizardFormData } from "./MultiStep"
import FeedbackModal from "../feedback/feedback-modal"
import CreditLockoutModal from "../credit/credit-lookout-modal"
import { CREDIT_COSTS } from "@/lib/billing/plans"
import { PLATFORMS, PLATFORM_LABELS, TONES, type Platform, type Tone } from "@/lib/platforms"
import { useAuth } from "../auth-provider"

const contentFormSchema = z.object({
  platform: z.array(z.enum(PLATFORMS)).min(1, "Choose at least one platform."),
  prompt: z
    .string()
    .trim()
    .min(5, { message: "Describe your post in at least 5 characters." })
    .max(2000, { message: "Keep the prompt under 2000 characters." }),
  tone: z.enum(TONES),
  audience: z.string().max(200).optional(),
})

interface CampaignIdeaProps {
  data?: WizardFormData
  setStepData: (topic: string, platform: Platform[], tone: Tone, audience: string, stepData: ContentGenerationResponse) => void
  setBusy: (busy: boolean) => void
}

const CampaignIdea = ({ data, setStepData, setBusy }: CampaignIdeaProps) => {
  const { toast } = useToast()
  const { user, refreshProfile } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<ContentGenerationResponse | null>(data?.step_1 || null)
  const [openFeedbackModal, setOpenFeedbackModal] = useState(false)
  const [showLockout, setShowLockout] = useState(false)

  const contentForm = useForm<z.infer<typeof contentFormSchema>>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      platform: data?.platform ?? [],
      prompt: data?.topic ?? "",
      tone: data?.tone ?? "Professional",
      audience: data?.audience ?? "",
    },
  })

  const onContentSubmit = async (values: z.infer<typeof contentFormSchema>) => {
    setIsGenerating(true)
    setBusy(true)
    try {
      const result = await generateContent({
        platform: values.platform,
        prompt: values.prompt,
        tone: values.tone,
        audience: values.audience || "",
      })

      setGeneratedContent(result)
      setStepData(values.prompt, values.platform, values.tone, values.audience || "", result)
      toast({
        title: "Content generated",
        description: `${CREDIT_COSTS.text} credits used. Review it below, then continue.`,
      })
    } catch (error: any) {
      if (isInsufficientCredits(error)) {
        setShowLockout(true)
      } else {
        toast({
          variant: "destructive",
          title: "Generation failed",
          description: error.message || "There was an error generating your content.",
        })
      }
    } finally {
      setIsGenerating(false)
      setBusy(false)
      refreshProfile()
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...contentForm}>
          <form onSubmit={contentForm.handleSubmit(onContentSubmit)} className="space-y-4">
            <FormField
              control={contentForm.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platforms</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={PLATFORMS.map((p) => ({ label: PLATFORM_LABELS[p], value: p }))}
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={contentForm.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What should the post be about?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Announce our new spring menu with 3 vegan dishes, launching this Friday"
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TONES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
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
                    <FormLabel>Target audience (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Marketing professionals" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" />
                Costs {CREDIT_COSTS.text} credits
                {user ? ` · ${user.credits} available` : ""}
              </p>
              <Button type="submit" disabled={isGenerating} className="sm:min-w-44">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : generatedContent ? (
                  "Regenerate"
                ) : (
                  "Generate Content"
                )}
              </Button>
            </div>
          </form>

          {generatedContent && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h2 className="text-xl font-semibold text-foreground">Generated content</h2>
                <button
                  type="button"
                  aria-label="Report a problem with this content"
                  title="Not happy with this? Tell us"
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  onClick={() => setOpenFeedbackModal(true)}
                >
                  <ThumbsDown className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <ContentPreviewComponent data={generatedContent} />
            </div>
          )}
        </Form>
      </CardContent>

      <FeedbackModal open={openFeedbackModal} onClose={() => setOpenFeedbackModal(false)} source="post_feedback" />
      <CreditLockoutModal
        isOpen={showLockout}
        onClose={() => setShowLockout(false)}
        credits={user?.credits ?? 0}
        cost={CREDIT_COSTS.text}
      />
    </Card>
  )
}

export default CampaignIdea
