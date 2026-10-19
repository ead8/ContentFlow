import Link from 'next/link'
import { ArrowRight, BarChart3, Calendar, Check, Image as ImageIcon, Layers, PencilLine, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { CREDIT_COSTS, PLANS } from '@/lib/billing/plans'

export default function Home() {
  const free = PLANS[0]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-foreground">ContentFlow</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
            <Button asChild size="sm"><Link href="/signup">Sign up</Link></Button>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-20 md:py-32">
          <div className="container mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm text-accent">AI writing assistant for social media</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Write a week of <span className="text-accent">social posts</span> in minutes
            </h1>
            <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
              Describe your idea once. ContentFlow writes a tailored version for each platform, creates
              images, keeps your content calendar and tracks how every post performs.
            </p>
            <div className="mb-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="h-12 gap-2 px-8">
                <Link href="/signup">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" />No credit card required</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" />{free.monthlyCredits} free credits every month</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-accent" />Cancel paid plans anytime</span>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-t border-border bg-card/30 px-4 py-20 md:py-28">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Everything in one workspace</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                From the first idea to the results, without juggling docs, image tools and spreadsheets.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<PencilLine className="h-8 w-8 text-accent" />}
                title="Platform-tailored copy"
                description="One prompt becomes posts for LinkedIn, Instagram, X, Facebook, TikTok and YouTube Shorts, each respecting the platform's length and style."
              />
              <FeatureCard
                icon={<ImageIcon className="h-8 w-8 text-accent" />}
                title="AI images and your own media"
                description="Generate an image from a description or upload your own photos and videos. Everything is kept in your media library."
              />
              <FeatureCard
                icon={<Layers className="h-8 w-8 text-accent" />}
                title="Edit before you post"
                description="Fine-tune every version, adjust hashtags and calls to action, with live character counts per platform."
              />
              <FeatureCard
                icon={<Calendar className="h-8 w-8 text-accent" />}
                title="Content calendar"
                description="Schedule posts and campaign milestones on a monthly calendar, with reminders when a post is due."
              />
              <FeatureCard
                icon={<ArrowRight className="h-8 w-8 text-accent" />}
                title="Publish in a click"
                description="Copy the finished text and open each platform's composer directly, pre-filled where the platform allows it."
              />
              <FeatureCard
                icon={<BarChart3 className="h-8 w-8 text-accent" />}
                title="Performance tracking"
                description="Record impressions, likes, comments and clicks for each post and see what works across platforms."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 px-4 py-20 md:py-28">
          <div className="container mx-auto max-w-3xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">How ContentFlow works</h2>
            </div>
            <div className="space-y-8">
              <StepCard number="1" title="Describe your idea" description="Pick your platforms, a tone and your audience, and tell ContentFlow what the post is about." />
              <StepCard number="2" title="Review the drafts" description="Get a tailored version for each platform. Edit anything, then add an AI image or your own media." />
              <StepCard number="3" title="Schedule it" description="Save a draft or schedule a date and time. ContentFlow reminds you when it's time to post." />
              <StepCard number="4" title="Post and measure" description="Copy each version into the platform, mark it as published, and record its results to compare performance." />
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-16 border-t border-border bg-card/30 px-4 py-20 md:py-28">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Simple, credit-based pricing</h2>
              <p className="text-muted-foreground">
                Generating posts for a campaign costs {CREDIT_COSTS.text} credits, an image costs {CREDIT_COSTS.image}.
                Every plan refreshes monthly.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PLANS.map((plan) => (
                <div key={plan.id} className="rounded-lg border bg-background p-5">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-4 text-2xl font-bold">{plan.monthlyCredits.toLocaleString('en-US')}</p>
                  <p className="text-sm text-muted-foreground">credits / month</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Start free, no card needed. See current prices for paid plans after signing up.
            </p>
          </div>
        </section>

        <section className="px-4 py-20 md:py-28">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">Ready to plan your next campaign?</h2>
            <Button asChild size="lg" className="h-12 gap-2 px-8">
              <Link href="/signup">
                Create your free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/30 px-4 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="font-semibold text-foreground">ContentFlow</span>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground" aria-label="Footer">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} ContentFlow</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-6 transition-colors hover:border-accent/50">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-accent-foreground">
        {number}
      </div>
      <div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
