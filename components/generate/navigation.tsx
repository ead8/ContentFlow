import { Button } from '@/components/ui/button'

interface NavigationProps {
  step: number
  totalSteps: number
  nextStep: () => void
  prevStep: () => void
  isNextDisabled: boolean
  isBackDisabled: boolean
  nextHint?: string
  nextLabel?: string
}

export function Navigation({
  step,
  totalSteps,
  nextStep,
  prevStep,
  isNextDisabled,
  isBackDisabled,
  nextHint,
  nextLabel = 'Next',
}: NavigationProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {isNextDisabled && nextHint && <span className="mr-auto text-sm text-muted-foreground">{nextHint}</span>}
      {step > 1 && (
        <Button variant="outline" onClick={prevStep} disabled={isBackDisabled}>
          Back
        </Button>
      )}
      {step < totalSteps && (
        <Button onClick={nextStep} disabled={isNextDisabled}>
          {nextLabel}
        </Button>
      )}
    </div>
  )
}
