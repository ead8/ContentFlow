'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'

const platforms = ['Instagram', 'X (Twitter)', 'LinkedIn', 'TikTok', 'Youtube Shorts', 'Facebook']
const contentStyles = ['Informative', 'Casual', 'Thought Leader', 'Persuasive']
const frequencies = ['Daily', '3x/Week', 'Weekly']

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [frequency, setFrequency] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()

  const totalSteps = 4

  const handleCheckbox = (item: string, list: string[], setList: Function) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item))
    } else {
      setList([...list, item])
    }
  }

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = () => {
    // Simulate saving to Supabase and webhook
    console.log('Saving onboarding data...')
    console.log({
      selectedPlatforms,
      selectedStyles,
      frequency,
      startDate,
    })
    setStep(step + 1)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Progress value={(step / totalSteps) * 100} className="mb-4" />
          <CardTitle className="text-2xl">
            {step === 1 && 'Choose Your Platforms'}
            {step === 2 && 'Content Style Preference'}
            {step === 3 && 'Posting Schedule'}
            {step === 4 && '🎉 You’re All Set!'}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 0 && (
            <div className="text-center space-y-4">
              <CardTitle className="text-2xl font-bold text-center">
                Welcome to Intuity Sync! Let’s Personalize Your Experience
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground mt-2">
                In just a few quick steps, we’ll tailor your social media automation just for you.
              </CardDescription>
              <Button onClick={handleNext}>Let’s Begin</Button>
              <Link href="/dashboard"><Button variant="ghost">Skip Setup</Button></Link>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">Select the platforms you want to automate:</p>
              <div className="grid grid-cols-2 gap-2">
                {platforms.map(p => (
                  <label key={p} className="flex items-center gap-2">
                    <Checkbox checked={selectedPlatforms.includes(p)} onCheckedChange={() => handleCheckbox(p, selectedPlatforms, setSelectedPlatforms)} />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">Choose your preferred content styles:</p>
              <div className="grid grid-cols-2 gap-2">
                {contentStyles.map(s => (
                  <label key={s} className="flex items-center gap-2">
                    <Checkbox checked={selectedStyles.includes(s)} onCheckedChange={() => handleCheckbox(s, selectedStyles, setSelectedStyles)} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm text-muted-foreground">How often should we post?</p>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="">Select frequency</option>
                  {frequencies.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-sm text-muted-foreground">When do you want to start?</p>
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                {startDate && <p className="text-sm mt-2">Selected: {format(startDate, 'PPP')}</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Thanks for completing your onboarding! 🚀</p>
              <Button onClick={() => console.log('Go to dashboard')}>Go to Dashboard</Button>
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < totalSteps && (
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              {step === totalSteps - 1 ? (
                <Button onClick={handleSubmit}>Save & Continue</Button>
              ) : (
                <Button onClick={handleNext}>Next</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
