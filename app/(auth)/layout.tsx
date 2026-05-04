import Image from "next/image";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex lg:h-screen">
      {/* Left Banner - Tech/Circuit Theme */}
      <div className="hidden relative lg:flex flex-1 bg-gradient-to-b from-[#1a0f3a] via-[#0f0820] to-[#0a0415] flex-col justify-between overflow-hidden">
        {/* Circuit Background Pattern */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <Image
            src="/images/background/auth_background.svg"
            alt="circuit background"
            fill
            className="object-cover"
          />
        </div>

        {/* Animated accent elements */}
        <div className="absolute top-10 right-10 w-32 h-32 bg-accent rounded-full blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-accent rounded-full blur-3xl opacity-5 animate-pulse" />

        {/* Content */}
        <div className="relative z-10 px-12 pt-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <svg className="h-6 w-6 text-accent-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">ContentFlow</h1>
          </div>
          <p className="text-accent text-sm font-medium">AI-Powered Social Content Platform</p>
        </div>

        {/* Bottom Messaging */}
        <div className="relative z-10 px-12 pb-12 space-y-8">
          {/* Key Features */}
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded bg-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Generate Content at Scale</p>
                <p className="text-accent/70 text-xs mt-1">Create weeks of content in minutes with AI assistance</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded bg-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Schedule Across Platforms</p>
                <p className="text-accent/70 text-xs mt-1">Publish simultaneously to LinkedIn, Instagram, X, and more</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded bg-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Measure What Matters</p>
                <p className="text-accent/70 text-xs mt-1">Real-time analytics on engagement and audience growth</p>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="pt-8 border-t border-accent/20">
            <p className="text-accent/80 text-xs leading-relaxed font-light">
              Transform your social media strategy with AI-powered content creation, intelligent scheduling, and deep analytics insights.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Area */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-12 lg:px-0">
        {children}
      </div>
    </div>
  )
}
