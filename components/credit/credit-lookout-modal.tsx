'use client'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useRouter } from 'next/navigation'


interface CreditLockoutModalProps {
  isOpen: boolean
  onClose: () => void
  /** Credits remaining in the wallet (profiles.credits) */
  credits?: number
  /** Monthly allowance of the user's plan */
  monthlyAllowance?: number
  /** Credits the blocked operation costs */
  requiredCredits?: number
  /** Defaults to closing the modal and opening the plans at /settings#billing */
  onUpgradeClick?: () => void
}

const CreditLockoutModal = ({
  isOpen,
  onClose,
  credits = 0,
  monthlyAllowance,
  requiredCredits,
  onUpgradeClick,
}: CreditLockoutModalProps) => {
  const router = useRouter()
  const handleUpgrade =
    onUpgradeClick ??
    (() => {
      onClose()
      router.push('/settings#billing')
    })

  const remaining = Math.max(0, credits)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center p-4">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-[#FFC107] rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl font-bold text-white" aria-hidden="true">!</span>
          </div>

          <DialogTitle className="text-xl font-semibold mb-3">Not enough credits</DialogTitle>

          {/* Credits Display */}
          <div className="flex items-center mb-4">
            <div className="mr-2">
              <Image
                src="/images/icons/credit.svg"
                alt=""
                width={26}
                height={26}
              />
            </div>
            <span className="text-[32px] font-semibold text-[#339DFF]">
              {remaining.toLocaleString()}
            </span>
            {monthlyAllowance !== undefined && monthlyAllowance > 0 && (
              <>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-[#828282]">{monthlyAllowance.toLocaleString()}</span>
              </>
            )}
            <span className="ml-2 text-sm text-muted-foreground">credits left</span>
          </div>

          {/* Message */}
          <DialogDescription className="text-gray-600 mb-6">
            {requiredCredits
              ? `This needs ${requiredCredits.toLocaleString()} credits and you have ${remaining.toLocaleString()} left.`
              : "You don't have enough credits left for this."}
            <br />
            Upgrade your plan or wait for your monthly credits to refresh.
          </DialogDescription>

          {/* Buttons */}
          <div className="flex gap-4 w-full max-w-xs">
            <Button
              variant="outline"
              className="flex-1  border-[#339DFF] text-[#339DFF] font-medium text-base"
              onClick={onClose}
            >
              Do it Later
            </Button>
            <Button
              className="flex-1 bg-[#2F80ED]"
              onClick={handleUpgrade}
            >
              Upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreditLockoutModal
