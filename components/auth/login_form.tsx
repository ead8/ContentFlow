"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui"
import { useAuth } from "../auth-provider"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"


const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
})

type LoginFormValues = z.infer<typeof loginSchema>

const LoginForm = () =>{
    
  const { signIn, sendMagicLink } = useAuth()
  const {toast} = useToast()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleSignIn = async (data: LoginFormValues) => {
    setIsLoading(true)
    
    try {
      const { error } = await signIn(data.email, data.password)
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: error.message,
        })
        return
      }
      
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in",
      })

      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error.message || "Failed to log in. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <svg className="h-6 w-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back to ContentFlow
        </h1>
        <p className="text-muted-foreground">Sign in to create amazing content</p>
      </div>
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSignIn)}>
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type="email"
                      placeholder="your@email.com"
                      className="pl-4 pr-10 bg-background border-input focus:border-accent"
                    />
                    <MailCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-4 pr-10 bg-background border-input focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      id="rememberMe"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                    />
                  </FormControl>
                  <FormLabel htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Remember me
                  </FormLabel>
                </FormItem>
              )}
            />
            <Link
              href="/resetPassword"
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          {/* Sign Up Link */}
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent font-medium hover:text-accent/80 transition-colors">
              Sign up
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default LoginForm
