"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react"

const data = [
  { name: "Mon", value: 240 },
  { name: "Tue", value: 139 },
  { name: "Wed", value: 380 },
  { name: "Thu", value: 290 },
  { name: "Fri", value: 430 },
  { name: "Sat", value: 328 },
  { name: "Sun", value: 539 },
]

export function QuickStatsSnapshot() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Total Posts"
            value="156"
            change="+12.3%"
            trend="up"
          />
          <StatCard
            title="Engagement Rate"
            value="5.2%"
            change="+0.8%"
            trend="up"
          />
          <StatCard
            title="Avg. Reach"
            value="12.4k"
            change="-2.1%"
            trend="down"
          />
          <StatCard
            title="Video Views"
            value="45.2k"
            change="+24.5%"
            trend="up"
          />
        </div>
        
        <div className="h-[200px] mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({ title, value, change, trend }: {
  title: string
  value: string
  change: string
  trend: "up" | "down"
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {trend === "up" ? (
          <ArrowUpRight className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold">{value}</p>
        <p className={`text-xs ${
          trend === "up" ? "text-green-500" : "text-red-500"
        }`}>
          {change} from last month
        </p>
      </div>
    </div>
  )
}