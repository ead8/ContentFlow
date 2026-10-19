"use client"

import OnboardingTitle from "./onboarding-title"

interface Platform {
  id: string
  name: string
  logo?: string
}

interface PlatformSelectorProps {
  selected: string[]
  setSelected: (val: string[]) => void
}

// ids match lib/platforms.ts so preferences line up with the content wizard
const platforms: Platform[] = [
  { id: "LinkedIn", name: "LinkedIn", logo: "/images/icons/linkedin.svg" },
  { id: "Instagram", name: "Instagram", logo: "/images/icons/instagram.svg" },
  { id: "X-Twitter", name: "X (Twitter)", logo: "/images/icons/x.svg" },
  { id: "Facebook", name: "Facebook", logo: "/images/icons/facebook.svg" },
  { id: "Tiktok", name: "TikTok" },
  { id: "YouTube_Shorts", name: "YouTube Shorts", logo: "/images/icons/youtube.svg" },
]

export default function PlatformSelector({ selected, setSelected }: PlatformSelectorProps) {
  const togglePlatform = (platformName: string) => {
    if (selected.includes(platformName)) {
      setSelected(selected.filter((id) => id !== platformName))
    } else {
      setSelected([...selected, platformName])
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-6">
      <OnboardingTitle title="Which platforms do you currently post on?" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.id)
          return (
            <div key={platform.id} className="relative">
              <button
                onClick={() => togglePlatform(platform.id)}
                className={`w-full h-full flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  isSelected ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-muted-foreground"
                }`}
                type="button"
                aria-pressed={isSelected}
              >
                <div className="w-16 h-16 mb-4 flex items-center justify-center">
                  {platform.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={platform.logo} alt="" className="w-10 h-10 mb-2" />
                  ) : (
                    <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background">
                      {platform.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-lg font-medium">{platform.name}</span>
              </button>
              <div className="absolute top-3 right-3">
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                    isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"
                  }`}
                >
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3 text-white"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}