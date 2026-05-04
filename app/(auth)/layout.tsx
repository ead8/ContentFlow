import { Sparkles } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex lg:h-screen bg-background">
      {/* Left Sidebar - ContentFlow Branding */}
      <div className="hidden bg-gradient-to-br from-card via-card to-muted/50 border-r border-border flex-1 lg:flex flex-col justify-between p-12">
        {/* Top - Logo */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">ContentFlow</h2>
            <p className="text-xs text-muted-foreground">AI-Powered Content Platform</p>
          </div>
        </div>

        {/* Bottom - Value Proposition */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI-Powered Content</h3>
                <p className="text-sm text-muted-foreground">Create engaging posts in seconds with advanced AI</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Real-Time Analytics</h3>
                <p className="text-sm text-muted-foreground">Track engagement and performance across platforms</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Smart Scheduling</h3>
                <p className="text-sm text-muted-foreground">Publish at optimal times for maximum reach</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Join thousands of creators and businesses using ContentFlow to streamline their social media strategy and grow their audience.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 lg:px-0">
        {children}
      </div>
    </div>
  )
}
