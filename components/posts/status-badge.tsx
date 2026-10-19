import { Badge } from "@/components/ui/badge"

const STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  published: { label: "Published", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
}

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { label: status, className: "" }
  return (
    <Badge variant="outline" className={`border-transparent ${style.className}`}>
      {style.label}
    </Badge>
  )
}
