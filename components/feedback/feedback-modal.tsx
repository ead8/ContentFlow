'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Star } from 'lucide-react'
import clsx from 'clsx'
import { addFeedback } from '@/lib/n8n/client'
import { useToast } from '@/hooks/use-toast'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'

const FeedbackSchema = z.object({
  feedback: z.string(),
  rating: z.number().min(0).max(5).default(0),
})

type FeedbackFormValues = z.infer<typeof FeedbackSchema>

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  source: 'error_feedback' | 'post_feedback'
}

const FeedbackModal = ({ open, onClose, source }: FeedbackModalProps) => {
  const { toast } = useToast()
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: {
      feedback: '',
      rating: 0,
    },
  })

  const { watch, setValue, handleSubmit, reset } = form
  const rating = watch('rating')

  const onSubmit = async (values: FeedbackFormValues) => {
    try {
      setIsLoading(true)
      await addFeedback({
        feedback: values.feedback || '',
        rating: values.rating || 0,
        source,
      })
      setSubmitted(true)
    } catch (error) {
     console.error('Error submitting feedback', error)
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if(!isLoading) {
      reset()
      setSubmitted(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{submitted ? 'Thank You!' : 'Help us improve'}</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              We’ve received your feedback and will work to fix the issue immediately.
            </p>
            <p className="text-sm text-gray-600">
              Please try again for now — and thank you for helping us improve!
            </p>
            <div className="flex justify-center mt-4">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Rating */}
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className="group"
                          aria-label={`${value} star`}
                        >
                          <Star
                            size={22}
                            className={clsx(
                              'transition-colors',
                              value <= rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {/* Feedback Text */}
              <FormField
                control={form.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="What went wrong?"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
                  Skip
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default FeedbackModal