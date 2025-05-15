'use client';

import { useForm } from "react-hook-form"
import { Button, Card, CardContent, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "../ui"
import { Select } from "@radix-ui/react-select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { generateContent } from "@/lib/n8n/client";
import { MultiSelect } from "../multiselect";
import { ContentGenerationResponse } from "@/models/content";
import ContentPreviewComponent from "./generatedContentPreview";
import { WizardFormData } from "./MultiStep";

const contentFormSchema = z.object({
  platform: z.array(z.enum(['linkedin', 'instagram', 'twitter', 'youtube', 'facebook', 'tiktok'])).min(1),
  prompt: z.string().min(5, {
    message: "Prompt must be at least 5 characters.",
  }),
  tone: z.enum(["professional", "casual", "enthusiastic", "informative"]),
  audience: z.string().optional(),
})

interface CampaignIdeaProps {
    data?: WizardFormData;    
    setStepData: (
      topic: string, 
      platform: Array<"linkedin" | "instagram" | "twitter" | "youtube" | "facebook" | "tiktok">,
      tone: "professional" | "casual" | "enthusiastic" | "informative",
      audience: string,
      stepData: ContentGenerationResponse
    ) => void;
    setNextStepValid: (isValid: boolean) => void;
    setBackStepValid: (isValid: boolean) => void;
}

const CampaignIdea = ({data, setStepData, setNextStepValid, setBackStepValid}: CampaignIdeaProps) => {
     const { toast } = useToast()
     const [isGeneratingText, setIsGeneratingText] = useState(false)
     const [generatedContent, setGeneratedContent] = useState<ContentGenerationResponse | null>(data?.step_1 || null)

      const contentForm = useForm<z.infer<typeof contentFormSchema>>({
        resolver: zodResolver(contentFormSchema),
          defaultValues: {
          platform: data?.platform ?? [],
          prompt: data?.topic ?? "",
          tone: data?.tone ?? "professional",
          audience: data?.audience ?? "",
          },
      })

      const onContentSubmit = async (values: z.infer<typeof contentFormSchema>) => {
        setIsGeneratingText(true)
        setGeneratedContent(null)
        setBackStepValid(false)
        try {
          const result = await generateContent({
            platform: values.platform,
            prompt: values.prompt,
            tone: values.tone,
            audience: values.audience || "",
          })

          setGeneratedContent(result);
          setStepData(
            values.prompt,
            values.platform,
            values.tone,
            values.audience || "",
            result
          );
          setNextStepValid(true);

          toast({
            title: "Content generated",
            description: "Your content has been successfully generated.",
          });
    
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Generation failed",
            description: error.message || "There was an error generating your content.",
          });
        } finally {
          setIsGeneratingText(false);
          setBackStepValid(true)
        }
      };

      return (
          <Card>
              <CardContent className="pt-6">
              <Form {...contentForm}>
                  <form onSubmit={contentForm.handleSubmit(onContentSubmit)} className="space-y-4">
                  <FormField
                    control={contentForm.control}
                    name="platform" // e.g. string[]
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Platforms</FormLabel>
                        <FormControl>
                            <MultiSelect
                            options={[
                                { label: 'LinkedIn', value: 'linkedin' },
                                { label: 'Instagram', value: 'instagram' },
                                { label: 'Twitter', value: 'twitter' },
                                { label: 'YouTube', value: 'youtube' },
                                { label: 'Facebook', value: 'facebook' },
                                { label: 'Tiktok', value: 'tiktok' },
                            ]}
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
                  {generatedContent && (
                    <div className="mt-6">
                        <h2 className="text-lg font-semibold mb-2">Generated Content Preview</h2>
                        <Card>
                        <CardContent className="whitespace-pre-wrap p-4 text-sm text-gray-700">
                            <ContentPreviewComponent data={generatedContent}/>
                        </CardContent>
                        </Card>
                    </div>
                )}
              </Form>
              </CardContent>
          </Card>
      )
}

export default CampaignIdea