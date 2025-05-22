"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type User = {
  id: string
  email: string
  role: 'admin' | 'user'
  credits: number
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  updatePassword: (password: string) => Promise<{ error: any }>
  signUp: (email: string) => Promise<{ error: any }>
  verifyOTP: (email: string, fullName: string, userType: string, token: string) => Promise<{ error: any }>
  reset: (email: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  sendMagicLink: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Fetch the user profile data from the profiles table
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: data?.role || 'user',
          credits: data?.credits || 0
        })
      }
      
      setIsLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Fetch the user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              role: data?.role || 'user',
              credits: data?.credits || 0
            })
            
            router.refresh()
            
            // If on the login page, redirect to dashboard
            if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
              router.push('/dashboard')
            }
          })
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        router.refresh()
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    })
    return { error }
  }

  const signUp = async (
  email: string,
  ): Promise<{ error: any }> => {
    // Send the OTP (magic link) to the user’s email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
    })
    
    if (otpError) return { error: otpError }

    return { error: null }
  };

  const verifyOTP = async (
  email: string,
  fullName: string,
  userType: string,
  token: string
  ): Promise<{ error: any }> => {
    // Verify the OTP
  const {
    data: { session },
    error: otpError,
  } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (otpError) return { error: otpError }

  // Step 2: Get the user ID from the session
  const userId = session?.user?.id
  if (!userId) return { error: 'No user found in session' }

  // Step 3: Insert or update the user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: fullName,
      user_type: userType,
      is_onboarded: false,
    })

  return { error: profileError || null }
  };

  const reset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/callback/resetPassword`,
      },
    )
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const value = {
    user,
    isLoading,
    signIn,
    updatePassword,
    signUp,
    verifyOTP,
    reset,
    signOut,
    sendMagicLink,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}