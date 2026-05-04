import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, Calendar, TrendingUp, Zap, Share2, Clock, Target } from 'lucide-react'
import Link from 'next/link'
import { ModeToggle } from '@/components/mode-toggle'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-foreground">ContentFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Sign up</Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 px-4">
          <div className="container mx-auto flex flex-col items-center text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm text-accent">Powered by advanced AI technology</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight text-foreground mb-6">
              Create and schedule <span className="text-accent">social content</span> at scale
            </h1>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              ContentFlow transforms the way teams create, manage, and publish social media content. Leverage AI-powered writing, intelligent scheduling, and comprehensive analytics to grow your audience faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/signup">
                <Button size="lg" className="h-12 px-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  View demo
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 justify-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent"></div>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent"></div>
                <span>7-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent"></div>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section id="features" className="py-20 md:py-32 px-4 border-t border-border bg-card/30">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything you need to dominate social media
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From AI-powered content creation to intelligent scheduling and detailed analytics, ContentFlow provides all the tools to manage your social presence efficiently.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Sparkles className="h-8 w-8 text-accent" />}
                title="AI Content Generation"
                description="Generate compelling posts instantly with advanced AI. Create in multiple tones, languages, and styles tailored to each platform."
              />
              <FeatureCard 
                icon={<Calendar className="h-8 w-8 text-accent" />}
                title="Smart Scheduling"
                description="Schedule posts for optimal times using AI-powered recommendations. Manage content across all platforms from one dashboard."
              />
              <FeatureCard 
                icon={<TrendingUp className="h-8 w-8 text-accent" />}
                title="Advanced Analytics"
                description="Track engagement, reach, and conversions with detailed insights. Understand what resonates with your audience."
              />
              <FeatureCard 
                icon={<Zap className="h-8 w-8 text-accent" />}
                title="Multi-Platform Integration"
                description="Seamlessly connect and publish to LinkedIn, Instagram, X, YouTube, TikTok, and Facebook from one place."
              />
              <FeatureCard 
                icon={<Share2 className="h-8 w-8 text-accent" />}
                title="Content Library Management"
                description="Organize, categorize, and reuse content. Build a scalable library of your best-performing posts."
              />
              <FeatureCard 
                icon={<Target className="h-8 w-8 text-accent" />}
                title="Audience Insights"
                description="Understand your audience demographics, preferences, and growth trends to refine your strategy."
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 md:py-32 px-4">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                How ContentFlow works
              </h2>
              <p className="text-muted-foreground">
                Get your content strategy off the ground in minutes, not months.
              </p>
            </div>
            
            <div className="space-y-8">
              <StepCard 
                number="1"
                title="Connect Your Accounts"
                description="Link your social media accounts securely. We support LinkedIn, Instagram, X, YouTube, TikTok, and Facebook with encrypted token storage."
              />
              <StepCard 
                number="2"
                title="Create or Generate Content"
                description="Write custom content or use our AI to generate posts in seconds. Customize tone, length, and messaging for each platform."
              />
              <StepCard 
                number="3"
                title="Schedule & Publish"
                description="Schedule posts for optimal times or publish immediately. Monitor performance across all platforms in real-time."
              />
              <StepCard 
                number="4"
                title="Analyze & Optimize"
                description="Track detailed metrics, understand audience behavior, and continuously refine your content strategy with data-driven insights."
              />
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 md:py-32 px-4 bg-card/50 border-t border-border">
          <div className="container mx-auto text-center max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to transform your social strategy?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Join hundreds of creators and businesses saving time and growing their audience with ContentFlow. Start your free trial today—no credit card required.
            </p>
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Social</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Twitter</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">GitHub</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent-foreground" />
              </div>
              <span className="font-semibold text-foreground">ContentFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 ContentFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode, 
  title: string, 
  description: string 
}) {
  return (
    <div className="bg-background rounded-lg p-6 border border-border transition-all duration-300 hover:border-accent/50 hover:bg-card/50">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function StepCard({ number, title, description }: {
  number: string,
  title: string,
  description: string
}) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground font-semibold">
          {number}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
