'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState, useEffect } from "react";
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

  // ✅ Store localTags per platform in state
  const [localTagsMap, setLocalTagsMap] = useState<Record<string, string[]>>({});

  // ✅ Sync initial hashtags from data
  useEffect(() => {
    const initialTags: Record<string, string[]> = {};
    platforms.forEach(([platform, post]) => {
      initialTags[platform] = post?.hashtags || [];
    });
    setLocalTagsMap(initialTags);
  }, [data]);

  const addTag = (platform: string, tag: string) => {
    if (!tag.trim()) return;
    const newTags = [...(localTagsMap[platform] || []), tag.trim()];
    setLocalTagsMap((prev) => ({ ...prev, [platform]: newTags }));
    onUpdate(platform, "hashtags", newTags);
  };

  const removeTag = (platform: string, tag: string) => {
    const newTags = (localTagsMap[platform] || []).filter((t) => t !== tag);
    setLocalTagsMap((prev) => ({ ...prev, [platform]: newTags }));
    onUpdate(platform, "hashtags", newTags);
  };

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
        return (
          <TabsContent key={platform} value={platform}>
            <div className="space-y-4 p-4 bg-white rounded-md shadow-sm">
              {/* Post */}
              <div className="space-y-2">
                <Label htmlFor={`post-${platform}`}>Post</Label>
                <Textarea
                  id={`post-${platform}`}
                  value={post.post || ""}
                  onChange={(e) => onUpdate(platform, "post", e.target.value)}
                  placeholder="Post content"
                />
              </div>

              {/* Call to Action */}
              <div className="space-y-2">
                <Label htmlFor={`cta-${platform}`}>Call to Action</Label>
                <Textarea
                  id={`cta-${platform}`}
                  value={post.call_to_action || ""}
                  onChange={(e) => onUpdate(platform, "call_to_action", e.target.value)}
                  placeholder="Call to Action"
                />
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label htmlFor={`hashtags-${platform}`}>Hashtags</Label>
                <Input
                  id={`hashtags-${platform}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(platform, e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                  placeholder="Type a hashtag and press Enter"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {(localTagsMap[platform] || []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      #{tag}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => removeTag(platform, tag)}
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
