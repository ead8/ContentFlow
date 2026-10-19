"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Settings, Users, AlertCircle } from "lucide-react"
import Link from "next/link"
import { fetchAccountSummary } from "@/lib/n8n/client"

interface Platform {
  name: string
  status: "connected" | "disconnected"
  profile?: string
  lastSync?: string
}

interface TeamMember {
  id: string
  name: string
  initials: string
  role: string
}

interface Subscription {
  upgradeAvailable?: boolean
}

interface AccountData {
  platforms: Platform[]
  teamMembers: TeamMember[]
  subscription: Subscription
}

export function AccountSummary() {
  const [accountData, setAccountData] = useState<AccountData>({
    platforms: [],
    teamMembers: [],
    subscription: {}
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAccountData() {
      try {
        const data = await fetchAccountSummary()
        setAccountData(data)
      } catch (error) {
        console.error('Failed to load account summary:')
      } finally {
        setIsLoading(false)
      }
    }

    loadAccountData()
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Account Overview</CardTitle>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings#accounts" aria-label="Manage connected accounts">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium mb-3">Connected Platforms</h4>
          <div className="space-y-2">
            {accountData.platforms.map((platform) => (
              <div
                key={platform.name}
                className="flex items-center justify-between p-2 rounded-md border"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {platform.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{platform.name}</p>
                    {platform.status === "connected" ? (
                      <p className="text-xs text-muted-foreground">
                        {platform.profile} • {platform.lastSync}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not connected
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={platform.status === "connected" ? "default" : "secondary"}
                >
                  {platform.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Team Members</h4>
            <Button variant="ghost" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </div>
          <div className="space-y-2">
            {accountData.teamMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {member.initials}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {accountData.subscription?.upgradeAvailable && (
          <div className="rounded-md bg-yellow-500/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-500">
                Upgrade Available
              </p>
              <p className="text-xs text-muted-foreground">
                Unlock more features with our Pro plan
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}