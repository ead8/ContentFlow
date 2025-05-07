import { Button } from '@/components/ui/button'
import { ArrowRight, BrainCircuit, Calendar, BarChart4, Image, PenTool } from 'lucide-react'
import Link from 'next/link'
import { ModeToggle } from '@/components/mode-toggle'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span>Intuity Sync</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign up</Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <section className="py-20 md:py-28">
          <div className="container flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tighter md:leading-none mb-6">
              Automate your social media <span className="text-primary">with AI</span>
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground mb-8">
              Create, schedule, and publish engaging content across all platforms with our AI-powered tools. Save time and grow your audience with intelligent automation.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="h-12 px-8">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-20 bg-muted/50">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">Supercharge your social presence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<PenTool className="h-8 w-8 text-primary" />}
                title="AI Content Generation"
                description="Create engaging posts optimized for each platform with the power of GPT. Generate weeks of content in minutes."
              />
              <FeatureCard 
                icon={<Image className="h-8 w-8 text-primary" />}
                title="Image & Video Creation"
                description="Generate stunning visuals that capture attention and drive engagement without needing design skills."
              />
              <FeatureCard 
                icon={<Calendar className="h-8 w-8 text-primary" />}
                title="Smart Scheduling"
                description="Schedule your content for optimal posting times across LinkedIn, Instagram, and YouTube."
              />
              <FeatureCard 
                icon={<BarChart4 className="h-8 w-8 text-primary" />}
                title="Performance Analytics"
                description="Track engagement, reach, and conversion metrics to optimize your content strategy."
              />
              <FeatureCard 
                icon={<BrainCircuit className="h-8 w-8 text-primary" />}
                title="Content Inspiration"
                description="Get AI-powered ideas based on trending topics in your industry and audience interests."
              />
              <FeatureCard 
                icon={<ArrowRight className="h-8 w-8 text-primary" />}
                title="Cross-Platform Publishing"
                description="Publish seamlessly to multiple platforms with format-specific optimizations."
              />
            </div>
          </div>
        </section>
        
        <section className="py-20">
          <div className="container text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to transform your social media?</h2>
            <p className="max-w-[600px] mx-auto text-muted-foreground mb-8">
              Join thousands of creators and businesses saving time and growing their audience with Intuity Sync.
            </p>
            <Link href="/signup">
              <Button size="lg" className="h-12 px-8">
                Start your free trial
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-muted-foreground">
            © 2025 Intuity Sync. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
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
    <div className="bg-card rounded-lg p-6 border transition-all duration-300 hover:shadow-md hover:border-primary/20">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}