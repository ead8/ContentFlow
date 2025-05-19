// components/feedback/feedback-modal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Star } from 'lucide-react'
import clsx from 'clsx'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (feedback: { text: string; rating: number }) => void
}

const FeedbackModal = ({ open, onClose, onSubmit }: FeedbackModalProps) => {
  const [text, setText] = useState('')
  const [rating, setRating] = useState(0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Help us improve</DialogTitle>
        </DialogHeader>

        {/* Rating */}
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="group"
              aria-label={`${value} star`}
            >
              <Star
                size={22}
                className={clsx(
                  'transition-colors',
                  value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                )}
              />
            </button>
          ))}
        </div>

        {/* Text feedback */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What went wrong? (optional but helpful)"
          className="min-h-[100px]"
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button
            onClick={() => {
              onSubmit({ text, rating })
              setText('')
              setRating(0)
              onClose()
            }}
            disabled={rating === 0}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FeedbackModal