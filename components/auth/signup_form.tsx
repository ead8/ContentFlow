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
    <div className="w-full px-6 pt-6 space-y-8 lg:p-0">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Signup</h1>
        <p className="text-gray-600">Enter the details below and continue.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Radio Group */}
          <FormField
            control={form.control}
            name="userType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who are you?</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-3 gap-2"
                  >
                    {[
                      { value: "Creator", label: "Creator" },
                      { value: "Agency", label: "Agency" },
                      { value: "Business Owner", label: "Business Owner" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        htmlFor={option.value}
                        className={`border rounded-md p-4 flex items-center space-x-2 cursor-pointer ${
                          field.value === option.value
                            ? "border-primary"
                            : "border-gray-300"
                        }`}
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={option.value}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{option.label}</span>
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
                <FormLabel>What is your Name?</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      placeholder="Full Name"
                      className="pr-10"
                    />
                  </div>
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
                <FormLabel>Enter your Email</FormLabel>
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

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            { isLoading ? "Sending OTP" : "Get OTP" }
          </Button>

          {/* Signup Link */}
          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default SignUpForm