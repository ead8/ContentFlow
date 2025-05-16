"use client"

import MultiStepWizard from "@/components/generate/MultiStep"

export default function GeneratePage() {

  return (
    <div className="mx-auto flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <MultiStepWizard/>
      </div>
    </div>
  )
}