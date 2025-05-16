'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

interface CreditLockoutModalProps {
  isOpen: boolean
  onClose: () => void
  usedCredits: number
  totalCredits: number
  onUpgradeClick?: () => void
}

const CreditLockoutModal = ({
  isOpen,
  onClose,
  usedCredits,
  totalCredits,
  onUpgradeClick,
}: CreditLockoutModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="text-destructive" />
            <DialogTitle className="text-lg">You're out of credits</DialogTitle>
          </div>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            You've used all your {totalCredits} credits this month.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 flex items-center justify-between text-sm font-medium bg-muted px-4 py-2 rounded-lg">
          <span>Usage</span>
          <span>
            {usedCredits} / {totalCredits}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Upgrade your plan to get more credits
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={onUpgradeClick}>
            Upgrade Plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreditLockoutModal