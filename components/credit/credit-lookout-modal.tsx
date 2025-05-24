'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Image from 'next/image'


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
    <Dialog open={isOpen} onOpenChange={onClose}>      <DialogContent className="sm:max-w-md">        <div className="flex flex-col items-center text-center p-4">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-[#FFC107] rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl font-bold text-white">!</span>
          </div>          {/* Credits Display */}
          <div className="flex items-center mb-4">
            <div className="mr-2">
              <Image 
                src="/images/icons/credit.svg"
                alt="Credit Icon"
                width={26}
                height={26}
              />
            </div>
            <span className="inline-flex items-center">
              <span className="text-[32px] font-semibold text-[#339DFF]">
                {/* {usedCredits} */}
                0
              </span>
            </span>
            <span className="text-gray-600">/</span>
            <span className="text-[#828282]">{totalCredits}</span>
            <span className="text-xl font-semibold ml-2">No Credits Available</span>
          </div>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            You don&apos;t have credit balance left to create a post.<br />
            Please upgrade to enjoy using services.
          </p>

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
              onClick={onUpgradeClick}
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