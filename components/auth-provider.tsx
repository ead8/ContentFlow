"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  fullName: string | null
  plan: string
  credits: number
  isOnboarded: boolean
}

type AuthResult = { error: { message: string } | null }

type AuthContextType = {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, fullName: string, userType: string) => Promise<AuthResult>
  resendCode: (email: string) => Promise<AuthResult>
  verifyOTP: (email: string, token: string, profile?: { fullName?: string; userType?: string }) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  reset: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  /** Re-read plan / credits after they change */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const loadUser = useCallback(
    async (authUser: { id: string; email?: string } | null) => {
      if (!authUser) {
        setUser(null)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, plan, credits, is_onboarded')
        .eq('id', authUser.id)
        .maybeSingle()

      setUser({
        id: authUser.id,
        email: authUser.email ?? '',
        fullName: data?.full_name ?? null,
        plan: data?.plan ?? 'free',
        credits: data?.credits ?? 0,
        isOnboarded: Boolean(data?.is_onboarded),
      })
    },
    [supabase]
  )

  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!active) return
      await loadUser(authUser)
      if (active) setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        loadUser(session?.user ?? null)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        router.refresh()
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase, router, loadUser])

  const value: AuthContextType = {
    user,
    isLoading,

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    },

    // Sends a 6-digit code (and creates the account if it doesn't exist).
    // The name / user type are stored as metadata and copied to the profile
    // by the handle_new_user trigger.
    signUp: async (email, fullName, userType) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/callback/signup`,
          data: { full_name: fullName, user_type: userType },
        },
      })
      return { error }
    },

    resendCode: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/callback/signup` },
      })
      return { error }
    },

    verifyOTP: async (email, token, profile) => {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) return { error }

      const userId = data.user?.id
      if (!userId) return { error: { message: 'Verification failed. Please try again.' } }

      // Existing accounts don't get new metadata applied, so set it directly
      if (profile?.fullName || profile?.userType) {
        await supabase
          .from('profiles')
          .update({
            ...(profile.fullName ? { full_name: profile.fullName } : {}),
            ...(profile.userType ? { user_type: profile.userType } : {}),
          })
          .eq('id', userId)
      }

      await loadUser(data.user)
      return { error: null }
    },

    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password })
      return { error }
    },

    reset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/callback/resetPassword`,
      })
      return { error }
    },

    signOut: async () => {
      await supabase.auth.signOut()
      setUser(null)
      router.push('/login')
      router.refresh()
    },

    refreshProfile: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      await loadUser(authUser)
    },
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
