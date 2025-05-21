"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "../ui";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../auth-provider";
import OnboardingModal from "./on_boarding_modal";

// Zod schema
const formSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long." })
      .max(64, { message: "Password must not exceed 64 characters." })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
      .regex(/[0-9]/, { message: "Password must contain at least one number." })
      .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character." }),

    confirmPassword: z
      .string()
      .min(8, { message: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof formSchema>;

export default function SetPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { updatePassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false);
  const [openOnboardingModal, setOpenOnboardingModal] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    },
  });

  // Submission
  const handleSetPassword = async (data: FormValues) => {
    setIsLoading(true)
    
    try {
     await updatePassword(data.password)

     setOpenOnboardingModal(true)

      // toast({
      //   title: "Password updated",
      //   description: "Your password has been successfully setted.",
      // })

      // router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while setting up your password.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    openOnboardingModal ? (
      <OnboardingModal onStart={() => router.push('onboarding')}/>
    ) : (
      <div className="flex flex-col gap-4 w-full">
        {/* <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()}/> */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Set Password</h1>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSetPassword)} className="w-full flex flex-col gap-4">
            <div className="w-full flex flex-col gap-4">
              <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                  <FormItem className="w-full">
                      <FormLabel>Password</FormLabel>
                      <FormControl className="w-full">
                          <div className="relative w-96">
                              <Input {...field} id="password" type={showPassword ? "text" : "password"} placeholder="Password" className="" />
                              {showPassword ? <EyeOff className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowPassword(!setShowPassword)} /> : <Eye className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowPassword(!showPassword)}/>}
                          </div>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
              )}
              />
              <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                          <div className="relative w-96">
                              <Input {...field} id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Password" className="" />
                              {showConfirmPassword ? <EyeOff className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowConfirmPassword(!showConfirmPassword)} /> : <Eye className="h-5 w-5 absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setShowConfirmPassword(!showConfirmPassword)}/>}
                          </div>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
              )}
              />
            </div>
            <Button type="submit" className="w-full max-w-sm my-4" disabled={isLoading}>
              {isLoading ? "Submitting" : "Set Password"}
            </Button>
          </form>
        </Form>
        <p className="text-sm text-gray-400 self-center">
          Already have an account? <a href="/login" className="text-blue-400 font-medium">Sign In</a>
        </p>
      </div>
    )
  );
}