import MultiStepWizard from "@/components/generate/MultiStep"

export const metadata = { title: "Create Post" }

export default function GeneratePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <MultiStepWizard />
    </div>
  )
}
