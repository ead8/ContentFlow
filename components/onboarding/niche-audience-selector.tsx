"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import OnboardingTitle from "./onboarding-title";

interface NicheAudienceValue {
  title: string;
  description: string;
}

interface NicheAudienceFormProps {
  value: NicheAudienceValue;
  setValue: (val: NicheAudienceValue) => void;
}

export default function NicheAudienceForm({
  value,
  setValue,
}: NicheAudienceFormProps) {
  const maxAudienceChars = 50;
  const [audienceCharCount, setAudienceCharCount] = useState(value.description.length);

  useEffect(() => {
    setAudienceCharCount(value.description.length);
  }, [value.description]);

  return (
    <div className="w-full max-w-xl mx-auto py-6">
      <OnboardingTitle
        title="What's your primary niche?"
        subtitle="Tell us more about your content focus and audience"
      />

      <div className="space-y-8 mt-8">
        {/* Niche Field */}
        <div className="space-y-3">
          <label htmlFor="niche" className="block text-sm font-medium text-gray-700">
            Tell us about your Niche
          </label>
          <Input
            id="niche"
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
            className="w-full px-4 py-3 text-base border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="e.g. Fitness, Travel, Technology"
          />
        </div>

        {/* Audience Field */}
        <div className="space-y-3">
          <label htmlFor="audience" className="block text-sm font-medium text-gray-700">
            Describe your audience in a few words
          </label>
          <div className="relative">
            <Textarea
              id="audience"
              value={value.description}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= maxAudienceChars) {
                  setValue({ ...value, description: val });
                }
              }}
              className="w-full px-4 py-3 text-base border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Describe your target audience"
              rows={3}
            />
            <div className="absolute bottom-2 right-3 text-sm text-muted-foreground bg-background px-1">
              {audienceCharCount}/{maxAudienceChars}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
