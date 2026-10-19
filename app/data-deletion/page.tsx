import type { Metadata } from "next"
import Link from "next/link"
import { BrainCircuit, CheckCircle2, Clock, XCircle } from "lucide-react"

import { ModeToggle } from "@/components/mode-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Data deletion - ContentFlow",
  description: "How to delete your ContentFlow data and check the status of a deletion request.",
  robots: { index: false, follow: false },
}

const CODE_RE = /^[a-f0-9]{32}$/

type RequestStatus = "pending" | "completed" | "failed"

interface LookupResult {
  state: "found" | "not_found" | "unavailable"
  status?: RequestStatus
  createdAt?: string
  completedAt?: string | null
}

async function lookup(code: string): Promise<LookupResult> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("data_deletion_requests")
      .select("status, created_at, completed_at")
      .eq("confirmation_code", code)
      .maybeSingle()
    if (error) return { state: "unavailable" }
    if (!data) return { state: "not_found" }
    return {
      state: "found",
      status: data.status as RequestStatus,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    }
  } catch {
    return { state: "unavailable" }
  }
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(d) + " UTC"
}

const STATUS_COPY: Record<RequestStatus, { label: string; text: string; Icon: typeof Clock; className: string }> = {
  completed: {
    label: "Completed",
    text: "The connected Facebook and Instagram accounts and their access tokens have been deleted.",
    Icon: CheckCircle2,
    className: "text-green-700 dark:text-green-400",
  },
  pending: {
    label: "In progress",
    text: "Your request has been received and is being processed.",
    Icon: Clock,
    className: "text-amber-700 dark:text-amber-400",
  },
  failed: {
    label: "Needs attention",
    text: "We could not finish this request automatically. Contact us with your confirmation code and we will complete it.",
    Icon: XCircle,
    className: "text-destructive",
  },
}

function StatusCard({ code, result }: { code: string; result: LookupResult }) {
  if (result.state !== "found" || !result.status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deletion request status</CardTitle>
          <CardDescription>
            Confirmation code <span className="break-all font-mono">{code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {result.state === "unavailable"
            ? "We could not look up this request right now. Please try again later."
            : "We could not find a deletion request with this confirmation code. Check that the link is complete."}
        </CardContent>
      </Card>
    )
  }

  const copy = STATUS_COPY[result.status] ?? STATUS_COPY.pending
  const received = formatDate(result.createdAt)
  const completed = result.status === "completed" ? formatDate(result.completedAt) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deletion request status</CardTitle>
        <CardDescription>
          Confirmation code <span className="break-all font-mono">{code}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className={`flex items-center gap-2 font-medium ${copy.className}`} role="status">
          <copy.Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {copy.label}
        </p>
        <p className="text-muted-foreground">{copy.text}</p>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
          {received && (
            <>
              <dt className="text-muted-foreground">Received</dt>
              <dd>{received}</dd>
            </>
          )}
          {completed && (
            <>
              <dt className="text-muted-foreground">Completed</dt>
              <dd>{completed}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const raw = typeof searchParams.code === "string" ? searchParams.code.trim().toLowerCase() : ""
  const code = CODE_RE.test(raw) ? raw : null
  const result = code ? await lookup(code) : null
  const invalidCode = !!raw && !code

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <BrainCircuit className="h-6 w-6 text-primary" aria-hidden="true" />
            <span>ContentFlow</span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-12">
        <h1 className="text-3xl font-bold text-primary sm:text-4xl">Data deletion</h1>

        {code && result && <StatusCard code={code} result={result} />}
        {invalidCode && (
          <Card>
            <CardHeader>
              <CardTitle>Deletion request status</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This confirmation code is not valid. Check that the link is complete.
            </CardContent>
          </Card>
        )}

        <section className="space-y-3" aria-labelledby="delete-social">
          <h2 id="delete-social" className="text-2xl font-semibold">
            Remove a connected social account
          </h2>
          <p className="text-muted-foreground">
            When you connect Facebook, Instagram, LinkedIn, X, TikTok or YouTube, we store the account&apos;s id, name,
            avatar and encrypted access tokens so we can publish your posts and read their metrics.
          </p>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>
              In the app: go to <strong className="text-foreground">Settings → Connected accounts</strong> and choose{" "}
              <strong className="text-foreground">Disconnect</strong>. The account and its tokens are deleted
              immediately.
            </li>
            <li>
              From Facebook: open Facebook <strong className="text-foreground">Settings &amp; privacy → Settings →
              Apps and websites</strong>, remove ContentFlow and choose to send a deletion request. We delete the
              Facebook Pages and Instagram accounts you connected and give you a confirmation code you can check on
              this page.
            </li>
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="delete-account">
          <h2 id="delete-account" className="text-2xl font-semibold">
            Delete your whole account
          </h2>
          <p className="text-muted-foreground">
            Sign in and go to <strong className="text-foreground">Settings → Danger zone → Delete account</strong>. This
            cancels any subscription and permanently deletes your profile, posts, schedule, analytics, connected
            accounts and media files. Posts already published on social platforms stay there; remove them on each
            platform if you wish.
          </p>
          <p className="text-muted-foreground">
            Can&apos;t sign in? Contact us from the email address on your account and we will delete it for you.
          </p>
        </section>

        <p className="text-sm text-muted-foreground">
          See our{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          for details on what we store and why.
        </p>
      </main>
    </div>
  )
}
