'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";
import { WizardFormData } from "./MultiStep";
import { Label } from "../ui";

interface CampaignContentTabsProps {
  data: WizardFormData;
  onUpdate: (platform: string, field: string, value: string | string[]) => void;
}

export default function CampaignContentTabs({
  data,
  onUpdate,
}: CampaignContentTabsProps) {
  const platforms = Object.entries(data?.step_1?.platform_posts || {});

  return (
    <Tabs defaultValue={platforms[0]?.[0]} className="w-full">
      <TabsList className="mb-4 overflow-x-auto">
        {platforms.map(([platform]) => (
          <TabsTrigger key={platform} value={platform} className="capitalize">
            {platform}
          </TabsTrigger>
        ))}
      </TabsList>

      {platforms.map(([platform, post]) => {
        const hashtags = post?.hashtags || [];

        const [localTags, setLocalTags] = useState<string[]>(hashtags);

        const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            const newTags = [...localTags, e.currentTarget.value.trim()];
            setLocalTags(newTags);
            onUpdate(platform, "hashtags", newTags);
            e.currentTarget.value = "";
            e.preventDefault();
          }
        };

        const removeTag = (tag: string) => {
          const updated = localTags.filter((t) => t !== tag);
          setLocalTags(updated);
          onUpdate(platform, "hashtags", updated);
        };

        return (
          <TabsContent key={platform} value={platform}>
            <div className="space-y-4 p-4 bg-white rounded-md shadow-sm">
                <div className="space-y-2">
                    <Label htmlFor={`post-${platform}`}>Post</Label>
                    <Textarea
                        value={post.post || ""}
                        onChange={(e) => {
                            onUpdate(platform, "post", e.target.value)
                        }
                        }
                        placeholder="Post content"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`post-${platform}`}>Call to Action</Label>
                    <Textarea
                        value={post.call_to_action || ""}
                        onChange={(e) => {
                            onUpdate(platform, "call_to_action", e.target.value)}
                        }
                        placeholder="Call to Action"
                    />
                </div>
              <div>
                <Input
                  onKeyDown={addTag}
                  placeholder="Type a hashtag and press Enter"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {localTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="flex items-center gap-1">
                      {tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
