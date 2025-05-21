'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from "@/hooks/use-toast"
import { createClient } from '../../lib/supabase/client'
import Link from 'next/link'
import { handleOnboarding } from '@/lib/api/supabase'

const platforms = ['Instagram', 'X (Twitter)', 'LinkedIn', 'TikTok', 'Youtube', 'Facebook']
const contentStyles = ['Informative', 'Casual', 'Thought Leader', 'Persuasive']
const frequencies = ['Daily', '3x/Week', 'Weekly']

export default function OnboardingPage() {
    const { toast } = useToast()
    const [step, setStep] = useState(1)
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
    const [selectedStyles, setSelectedStyles] = useState<string[]>([])
    const [frequency, setFrequency] = useState('')
    const [startDate, setStartDate] = useState<Date | undefined>()
    const [loading, setLoading] = useState(false)

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

    const formatDate = (date: Date | null): string => {
        if (!date) return ''
        const formattedDate = date.toISOString().split('T')[0] // Get YYYY-MM-DD
        return formattedDate
    }

    const handleSubmit = async () => {
        try {
            setLoading(true)

            // Initialize Supabase client
            const supabase = createClient()
            
            // Get session data
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                throw new Error('User is not authenticated')
            }

            const response = await handleOnboarding({
                platforms: selectedPlatforms,
                content_styles: selectedStyles,
                post_frequency: frequency,
                start_date: startDate ? formatDate(startDate) : null,
                user_id: session.user?.id, // Ensure user exists and is valid
            })

            if (response) {
                // Webhook trigger
                const webhookUrl = 'https://auth3ntica1.app.n8n.cloud/webhook-test/61d2ce2a-d737-48f6-81b2-cc8946d3c62f'
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify("data"),
                })
                toast({
                    title: 'Success',
                    description: 'Your onboarding data has been submitted successfully!',
                    variant: 'default',
                })
                setStep(4) // Set step to 4 to show the success message
                // router.push('/dashboard')
            } else {
                toast({
                    title: 'Error',
                    description: 'There was an error submitting your onboarding data. Please try again.',
                    variant: 'destructive',
                })
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'There was an error submitting your onboarding data. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
            <Progress 
                value={(step / totalSteps) * 100} 
                className="mb-4 transition-all duration-500 ease-in-out h-2 bg-ivory border-2 border-gray-300 rounded-full shadow-lg"
                style={{ backgroundColor: '#f8f1e5' }} // Soft ivory background
            >
                <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-800 rounded-full shadow-xl" 
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                />
            </Progress>
            <CardTitle className="text-2xl font-bold">
                {step === 1 && 'Choose Your Platforms'}
                {step === 2 && 'Content Style Preference'}
                {step === 3 && 'Posting Schedule'}
                {step === 4 && '🎉 You’re All Set!'}
            </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">

            {step === 1 && (
                <div>
                <p className="mb-4 text-sm">Select the platforms you want to automate:</p>
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
                <p className="mb-4 text-sm">Choose your preferred content styles:</p>
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
                <div className="space-y-2">
                    <p className="mb-1 text-sm">How often should we post?</p>
                    <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    >
                    <option value="">Select frequency</option>
                    {frequencies.map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <p className="mb-1 text-sm">When do you want to start?</p>
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                </div>
                </div>
            )}

            {step === 4 && (
                <div className="flex flex-col gap-4 text-center">
                    <p className="text-muted-foreground">Thanks for completing your onboarding! 🚀</p>
                    <Link href="/dashboard">
                        <Button>Go to Dashboard</Button>
                    </Link>
                </div>
            )}

            {/* Navigation */}
            {
                step !== 4 && (
                    <div className="flex justify-end pt-4 gap-2">
                        {
                            step > 1 && step <= totalSteps && (
                                <Button variant="ghost" onClick={handleBack} disabled={loading}>Back</Button>
                            )
                        }
                        {step === totalSteps - 1 ? (
                        <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save & Continue'}</Button>
                        ) : (
                        <Button onClick={handleNext} disabled={loading}>Next</Button>
                        )}
                    </div>
                )
            }
            </CardContent>
        </Card>
        </div>
    )
}