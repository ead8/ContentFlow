"use client"

import { type FormEvent, useId, useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

const CONFIRM_WORD = "DELETE"

/**
 * "Danger zone" card: permanently deletes the signed-in user's account via
 * DELETE /api/account, then sends them to the landing page.
 */
export function DeleteAccountCard() {
  const { toast } = useToast()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()

  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = confirmText.trim() === CONFIRM_WORD

  function handleOpenChange(next: boolean) {
    if (deleting) return
    setOpen(next)
    if (!next) {
      setConfirmText("")
      setError(null)
    }
  }

  async function handleDelete(event?: FormEvent) {
    event?.preventDefault()
    if (!confirmed || deleting) return
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Could not delete your account. Please try again.")
      }

      // The server already cleared the session cookies; drop the in-memory
      // session too. The user no longer exists, so ignore errors.
      await createClient()
        .auth.signOut({ scope: "local" })
        .catch(() => {})

      toast({ title: "Account deleted", description: "Your account and data have been permanently deleted." })
      window.location.assign("/")
    } catch (e: any) {
      const message = e?.message || "Could not delete your account. Please try again."
      setError(message)
      setDeleting(false)
      toast({ variant: "destructive", title: "Account not deleted", description: message })
    }
  }

  return (
    <Card className="border-destructive/50 dark:border-destructive/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          Danger zone
        </CardTitle>
        <CardDescription>Permanently delete your account and everything in it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Deleting your account cannot be undone. It will:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Cancel any active subscription immediately (no further charges; the current period is not refunded).</li>
          <li>Delete your posts, drafts, schedule, analytics, notifications and credit history.</li>
          <li>Disconnect all social accounts and delete their stored (encrypted) access tokens.</li>
          <li>Delete your uploaded and generated media files.</li>
          <li>Delete your profile and sign you out.</li>
        </ul>
        <p className="text-muted-foreground">
          Posts already published to your social accounts stay on those platforms; remove them there if needed.
        </p>
      </CardContent>
      <CardFooter>
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form onSubmit={handleDelete} className="grid gap-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your subscription will be canceled and all of your data will be deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-2">
                <Label htmlFor={inputId}>
                  Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
                </Label>
                <Input
                  id={inputId}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={deleting}
                  aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                  aria-invalid={error ? true : undefined}
                />
                <p id={hintId} className="sr-only">
                  The delete button is enabled once you type {CONFIRM_WORD} in capital letters.
                </p>
                {error && (
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel type="button" disabled={deleting}>
                  Cancel
                </AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={!confirmed || deleting} aria-busy={deleting}>
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Deleting…
                    </>
                  ) : (
                    "Delete account"
                  )}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}
