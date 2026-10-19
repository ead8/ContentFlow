'use client'

import Link from 'next/link'
import { Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CreditLockoutModalProps {
  isOpen: boolean
  onClose: () => void
  /** Current balance */
  credits: number
  /** Cost of the action the user tried */
  cost: number
}

/**
 * Shown when an AI action costs more credits than the user has left.
 */
const CreditLockoutModal = ({ isOpen, onClose, credits, cost }: CreditLockoutModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <Coins className="h-7 w-7 text-amber-500" />
          </div>
          <DialogTitle>Not enough credits</DialogTitle>
          <DialogDescription>
            This action costs {cost} credits and you have {credits} left. Upgrade your plan to get
            more credits every month.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Not now
          </Button>
          <Button asChild className="flex-1">
            <Link href="/billing">See plans</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreditLockoutModal
