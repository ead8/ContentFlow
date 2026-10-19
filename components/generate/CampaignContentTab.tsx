'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { PlatformPost } from "@/models/content";
import { PLATFORM_CHAR_LIMITS, composeVariantText, platformLabel, type Platform } from "@/lib/platforms";

interface CampaignContentTabsProps {
  posts: Record<string, PlatformPost>;
  onUpdate: (platform: string, field: string, value: string | string[]) => void;
}

/**
 * Per-platform editor: post text, call to action and hashtags, with a live
 * character count against the platform's limit.
 */
export default function CampaignContentTabs({ posts, onUpdate }: CampaignContentTabsProps) {
  const platforms = Object.entries(posts || {});

  if (platforms.length === 0) {
    return <p className="text-sm text-muted-foreground">No platform content yet.</p>;
  }

  const addTag = (platform: string, current: string[], raw: string) => {
    const tags = raw
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#+/, "").trim())
      .filter(Boolean)
      .filter((t) => !current.includes(t));
    if (tags.length) onUpdate(platform, "hashtags", [...current, ...tags]);
  };

  return (
    <Tabs defaultValue={platforms[0][0]} className="w-full">
      <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
        {platforms.map(([platform]) => (
          <TabsTrigger key={platform} value={platform}>
            {platformLabel(platform)}
          </TabsTrigger>
        ))}
      </TabsList>

      {platforms.map(([platform, post]) => {
        const tags = post.hashtags || [];
        const limit = PLATFORM_CHAR_LIMITS[platform as Platform];
        const length = composeVariantText(post).length;
        const over = limit !== undefined && length > limit;

        return (
          <TabsContent key={platform} value={platform}>
            <div className="space-y-4 rounded-md border bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`post-${platform}`}>Post</Label>
                  {limit !== undefined && (
                    <span className={`text-xs ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {length.toLocaleString()} / {limit.toLocaleString()} characters (incl. CTA & hashtags)
                    </span>
                  )}
                </div>
                <Textarea
                  id={`post-${platform}`}
                  value={post.post || ""}
                  onChange={(e) => onUpdate(platform, "post", e.target.value)}
                  placeholder="Post content"
                  className="min-h-40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`cta-${platform}`}>Call to action</Label>
                <Input
                  id={`cta-${platform}`}
                  value={post.call_to_action || ""}
                  onChange={(e) => onUpdate(platform, "call_to_action", e.target.value)}
                  placeholder="e.g. Book your table today"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`hashtags-${platform}`}>Hashtags</Label>
                <Input
                  id={`hashtags-${platform}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(platform, tags, e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                  onBlur={(e) => {
                    addTag(platform, tags, e.currentTarget.value);
                    e.currentTarget.value = "";
                  }}
                  placeholder="Type a hashtag and press Enter"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="flex items-center gap-1">
                      #{tag}
                      <button
                        type="button"
                        aria-label={`Remove #${tag}`}
                        className="rounded-sm hover:text-destructive"
                        onClick={() => onUpdate(platform, "hashtags", tags.filter((t) => t !== tag))}
                      >
                        <X className="h-3 w-3" />
                      </button>
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
