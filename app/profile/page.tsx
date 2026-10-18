"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Coins, CalendarDays, LogOut, User as UserIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error || `Request failed (${res.status})`)
  }
  return body.data as T
}

interface ProfileState {
  email: string
  name: string
  role: string
  credits: number
  memberSince: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) throw new Error("Not signed in")
        const [account, wallet] = await Promise.all([
          api<{ teamMembers: { name: string; role: string }[] }>("/api/dashboard/account"),
          api<{ available_credits: number }>("/api/credits"),
        ])
        const member = account.teamMembers?.[0]
        setProfile({
          email: user.email,
          name: member?.name || user.email.split("@")[0],
          role: member?.role || "Member",
          credits: wallet.available_credits ?? 0,
          memberSince: user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—",
        })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could not load profile", description: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!profile) {
    return <div className="text-center py-20 text-muted-foreground">Could not load your profile.</div>
  }

  const initials = profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <main className="mx-auto max-w-2xl py-8 px-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
            {initials || <UserIcon className="h-8 w-8" />}
          </div>
          <div>
            <CardTitle>{profile.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{profile.role}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{profile.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span>{profile.credits} credits available</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>Member since {profile.memberSince}</span>
          </div>
          <div className="pt-4 border-t flex gap-2">
            <Button variant="outline" onClick={() => router.push("/settings")}>Edit settings</Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
