import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Post statuses (content_posts.status) and target statuses (post_targets.status). */
const STATUS_STYLES: Record<string, { label: string; className: string; spin?: boolean }> = {
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  publishing: {
    label: "Publishing",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    spin: true,
  },
  published: {
    label: "Published",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  // Dashboard API maps published -> posted
  posted: {
    label: "Published",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  partially_published: {
    label: "Partially published",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  needs_manual: {
    label: "Needs manual post",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
}

export const POST_STATUS_FILTERS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "publishing", label: "Publishing" },
  { value: "published", label: "Published" },
  { value: "partially_published", label: "Partially published" },
  { value: "failed", label: "Failed" },
] as const

export function statusLabel(status: string): string {
  return STATUS_STYLES[status]?.label ?? status.replace(/_/g, " ")
}

/** Tailwind classes for small status chips (e.g. calendar cells). */
export function statusChipClass(status: string): string {
  return STATUS_STYLES[status]?.className ?? "bg-muted text-foreground"
}

export function PostStatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status]
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap",style?.className, !style && "capitalize", className)}
    >
      {style?.spin && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />}
      {statusLabel(status)}
    </Badge>
  )
}

export default PostStatusBadge
