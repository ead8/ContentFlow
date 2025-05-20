"use client"

import { useState } from "react"
import OnboardingTitle from "./onboarding-title"

interface Platform {
  id: string
  name: string
  logo: string
}

const platforms: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    logo: "/images/icons/instagram.svg",
  },
  {
    id: "youtube",
    name: "Youtube",
    logo: "/images/icons/youtube.svg",
  },
  {
    id: "linkedin",
    name: "Linkedin",
    logo: "/images/icons/linkedin.svg",
  },
  {
    id: "facebook",
    name: "Facebook",
    logo: "/images/icons/facebook.svg",
  },
  {
    id: "x",
    name: "X",
    logo: "/images/icons/x.svg",
  },
]

export default function PlatformSelector() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((id) => id !== platformId) : [...prev, platformId],
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <OnboardingTitle title="Which platforms do you currently post on?" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id)
          return (
            <div key={platform.id} className="relative">
              <button
                onClick={() => togglePlatform(platform.id)}
                className={`w-full h-full flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                type="button"
                aria-pressed={isSelected}
              >
                <div className="w-16 h-16 mb-4 flex items-center justify-center">
                    <img src={platform.logo} alt={platform.name} className="w-10 h-10 mb-2" />
                  {/* <PlatformILogo platform={platform.id} /> */}
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

function PlatformLogo({ platform }: { platform: string }) {
  switch (platform) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <defs>
            <radialGradient id="instagram-gradient" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#instagram-gradient)" />
          <circle cx="12" cy="12" r="4" fill="white" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="white" />
        </svg>
      )
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <rect x="2" y="5" width="20" height="14" rx="5" fill="#FF0000" />
          <polygon points="10 9 16 12 10 15" fill="white" />
        </svg>
      )
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#0077B5" />
          <path
            d="M8 10V16M8 7V7.01M12 16V10M16 16V12C16 10.8954 15.1046 10 14 10C12.8954 10 12 10.8954 12 12"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#1877F2" />
          <path
            d="M17 12.5H14V9.5C14 8.9 14.4 9 15 9H16V6H14C12.3 6 11 7.3 11 9V12.5H9V15.5H11V22H14V15.5H16L17 12.5Z"
            fill="white"
          />
        </svg>
      )
    case "x":
      return (
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="black" />
          <path
            d="M17.7 7.5L14.7 11.2L18.2 16.5H15.6L13.3 13L10.6 16.5H8L11.3 12.4L8 7.5H10.6L12.7 10.7L15.1 7.5H17.7Z"
            fill="white"
          />
        </svg>
      )
    default:
      return null
  }
}