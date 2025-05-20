"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import OnboardingTitle from "./onboarding-title"

export default function NicheAudienceForm() {
  const [niche, setNiche] = useState("")
  const [audience, setAudience] = useState("")
  const [audienceCharCount, setAudienceCharCount] = useState(0)
  const maxAudienceChars = 50

  useEffect(() => {
    setAudienceCharCount(audience.length)
  }, [audience])

  const handleAudienceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= maxAudienceChars) {
      setAudience(value)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto py-8">
      {/* Main Title */}
      <OnboardingTitle
        title="What's your primary niche?"
        subtitle="Tell us more about your content focus and audience"
      />

      <div className="space-y-8 mt-8">
        {/* Niche Input */}
        <div className="space-y-3">
          <label htmlFor="niche" className="block text-sm font-medium text-gray-700">
            Tell us about your Niche
          </label>
          <div className="relative">
            <Input
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full px-4 py-3 text-base border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="e.g. Fitness, Travel, Technology"
            />
          </div>
        </div>

        {/* Audience Input */}
        <div className="space-y-3">
          <label htmlFor="audience" className="block text-sm font-medium text-gray-700">
            Describe your audience in few words
          </label>
          <div className="relative">
            <Textarea
              id="audience"
              value={audience}
              onChange={handleAudienceChange}
              className="w-full px-4 py-3 text-base border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Describe your target audience"
              rows={3}
            />
            <div className="absolute bottom-2 right-3 text-sm text-gray-500 bg-white px-1">
              {audienceCharCount}/{maxAudienceChars}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
