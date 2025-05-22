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
    <div className="w-full px-6 pt-16 space-y-8 lg:p-0">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome to <span className="text-primary">Intuity Sync</span>
        </h1>
        <p className="text-gray-600">Turn your content chaos into strategic growth with AI.</p>
      </div>
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSignIn)}>
            {/* Email Field */}
            <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                    <div className="relative">
                    <Input
                        {...field}
                        placeholder="Email"
                        className="pr-10"
                    />
                    <MailCheck className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

            <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
                <FormItem className="w-full">
                    <FormLabel>Password</FormLabel>
                    <FormControl className="w-full">
                        <div className="relative">
                            <Input {...field} id="password" type={showPassword ? "text" : "password"} placeholder="Password" className="" />
                            {showPassword ? <EyeOff className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowPassword(!setShowPassword)} /> : <Eye className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowPassword(!showPassword)}/>}
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
            />

            <div className="flex items-center justify-between">
                <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                    <FormItem className="">
                        <div className="flex items-center gap-2">
                            <FormControl className="">
                                <Checkbox
                                id="terms"
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(!!checked)}
                                />
                            </FormControl>
                            <FormLabel className="text-sm font-normal text-gray-600" htmlFor="rememberMe">
                                Remember me
                            </FormLabel>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
                />

                <Link
                href="/resetPassword"
                className="text-sm text-gray-600 hover:text-[#0ea5e9] hover:underline"
                >
                Forgot Password?
                </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
            </Button>
          
            <div className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline">
                    Sign Up
                </Link>
            </div>
        </form>
      </Form>
    </div>
  )
}

export default LoginForm