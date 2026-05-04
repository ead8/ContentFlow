"use client"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../auth-provider"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  userType: z.enum(["Creator", "Agency", "Business Owner"]),
  fullName: z.string().min(2, "Please enter your name"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
})

type SignUpFormValues = z.infer<typeof formSchema>

const SignUpForm = () => {
  const {signUp} = useAuth()
  const router = useRouter()
  const {toast} = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userType: "Creator",
      fullName: "",
      email: "",
    },
  })

  const onSubmit = async(data: SignUpFormValues) => {
    try {
      setIsLoading(true)

      const { error } = await signUp(data.email)

      if(error) {
        throw error
      }
      router.push(`/otp?email=${data.email}&fullName=${data.fullName}&type=${data.userType}`)
    } catch (error) {
      setIsLoading(false)
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
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
          Join ContentFlow
        </h1>
        <p className="text-muted-foreground">Create amazing content with AI assistance</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* User Type Radio Group */}
          <FormField
            control={form.control}
            name="userType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">I am a:</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-3 gap-2"
                  >
                    {[
                      { value: "Creator", label: "Creator" },
                      { value: "Agency", label: "Agency" },
                      { value: "Business Owner", label: "Business" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        htmlFor={option.value}
                        className={`border rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                          field.value === option.value
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={option.value}
                          className="sr-only"
                        />
                        <span className="text-xs font-medium text-center">{option.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Full Name Field */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Full Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="John Doe"
                    className="bg-background border-input focus:border-accent"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          {/* Sign In Link */}
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent font-medium hover:text-accent/80 transition-colors">
              Sign in
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default SignUpForm
