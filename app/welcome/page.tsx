'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { fetchLoggedinUserProfile } from '@/lib/api/supabase'
import { UserProfile } from '@/models/user'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function WelcomePage() {
    const router = useRouter()
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)

        const fetchUserProfile = async () => {
            try {
                const profile = await fetchLoggedinUserProfile()
                setUserProfile(profile)
            } catch (error) {
                console.error('Error fetching user profile:', error)
            }
        }
        fetchUserProfile()
    }, [])

    useEffect(() => {
        if (userProfile && userProfile.is_onboarded) {
            // Redirect to dashboard if user is already onboarded
            router.push('/dashboard')
        }

        else if(userProfile && !userProfile.is_onboarded) {  
            setLoading(false)
        }
    }, [userProfile])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg">
            <CardContent className="py-8">
                <div className="text-center flex flex-col items-center gap-4">
                <CardTitle className="text-xl font-bold text-center">
                    Welcome to Intuity Sync – let’s automate your content like a pro.
                </CardTitle>
                <CardDescription className="text-center text-muted-foreground mt-2">
                    In just a few quick steps, we’ll tailor your social media automation just for you.
                </CardDescription>
                <div className='w-full flex justify-end mt-2 gap-2'>
                    <Link href="/onboarding"><Button>Let’s Begin</Button></Link>
                    <Link href="/dashboard"><Button variant="ghost">Skip</Button></Link>
                </div>
                </div>
            </CardContent>
        </Card>
        </div>
    )
}