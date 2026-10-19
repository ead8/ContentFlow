"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogOut, Save, KeyRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { ConnectedAccounts } from "@/components/settings/connected-accounts"
import { DeleteAccountCard } from "@/components/settings/delete-account"
import { useAuth } from "@/components/auth-provider"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [savingName, setSavingName] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const { signOut, refreshProfile } = useAuth()

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Not signed in")
        setEmail(user.email || "")
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
        setFullName(profile?.full_name || "")
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could not load settings", description: e.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not signed in")
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null })
        .eq("id", user.id)
      if (error) throw error
      await refreshProfile()
      toast({ title: "Profile updated" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message })
    } finally {
      setSavingName(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Password too short", description: "Use at least 8 characters." })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match" })
      return
    }
    setSavingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword(""); setConfirmPassword("")
      toast({ title: "Password updated" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Password update failed", description: e.message })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = () => signOut()



  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How your name appears across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Display name</Label>
            <Input
              id="fullName"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveName} disabled={savingName}>
            {savingName ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <ConnectedAccounts />

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button onClick={handlePasswordChange} disabled={savingPassword}>
            {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Update password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of ContentFlow on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  )
}
