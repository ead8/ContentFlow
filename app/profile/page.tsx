"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Coins, Loader2, Mail, CalendarDays, Briefcase } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchLoggedinUserProfile } from "@/lib/api/supabase"
import { fetchAccountSummary, type AccountSummaryData } from "@/lib/api/client"
import type { UserProfile } from "@/models/user"
import { getPlan } from "@/lib/billing/plans"
import { platformLabel } from "@/lib/platforms"

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [account, setAccount] = useState<AccountSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchLoggedinUserProfile(), fetchAccountSummary()])
      .then(([p, a]) => {
        setProfile(p)
        setAccount(a)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="text-destructive">Could not load profile: {error}</p>
  if (!profile || !account) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const plan = getPlan(profile.plan)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground">
            {account.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{profile.full_name || account.name}</p>
            <p className="text-sm text-muted-foreground">{profile.user_type || "Member"}</p>
          </div>
          <Button asChild variant="outline" className="ml-auto">
            <Link href="/settings">Edit</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{profile.email}</p>
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Member since {format(new Date(profile.created_at), "MMMM yyyy")}
          </p>
          <p className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            {profile.credits.toLocaleString()} credits · {plan.name} plan
            <Link href="/billing" className="text-primary underline-offset-4 hover:underline">Manage</Link>
          </p>
          {account.businessType && (
            <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" />{account.businessType}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Content preferences</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/onboarding">{profile.is_onboarded ? "Update" : "Set up"}</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {account.niche && <p><span className="font-medium">Niche:</span> {account.niche}</p>}
          {account.platforms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {account.platforms.map((p) => <Badge key={p} variant="secondary">{platformLabel(p)}</Badge>)}
            </div>
          ) : (
            <p className="text-muted-foreground">No preferences saved yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
