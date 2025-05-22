"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../auth-provider";
import { useToast } from "@/hooks/use-toast";

// Zod schema
const formSchema = z.object({
  otp: z.string().min(6, {
    message: "Your otp password must be 6 characters.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function OTPVerificationForm() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const fullName = searchParams.get('fullName')
  const userType = searchParams.get('type')

  const {verifyOTP} = useAuth()
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { toast } = useToast()
  const [timer, setTimer] = useState(15);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      otp: "",
    },
  });

  // Countdown timer
  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);


  // Submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsLoading(true)
      const {error} = await verifyOTP(
        email ?? "",
        fullName ?? "",
        userType ?? "",
        data.otp
      )
      
      if(error) {
        throw error
      }

      router.push('/setPassword')
    } catch (error) {
      setIsLoading(false)
      toast({
        title: "Error",
        description: "An error occurred while verifying your OTP.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  };

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 lg:p-0">
      <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()}/>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">OTP Verification Required</h1>
        <p className="text-sm">
            Please enter OTP sent to <span className="text-blue-400">{email}</span>
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <FormField
            control={form.control}
            name="otp"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Input your OTP code</FormLabel>
                <FormControl>
                    <InputOTP {...field} maxLength={6} className="w-full">
                        <InputOTPGroup className="w-full">
                            <InputOTPSlot index={0} className="w-full"/>
                            <InputOTPSlot index={1} className="w-full"/>
                            <InputOTPSlot index={2} className="w-full"/>
                            <InputOTPSlot index={3} className="w-full"/>
                            <InputOTPSlot index={4} className="w-full"/>
                            <InputOTPSlot index={5} className="w-full"/>
                        </InputOTPGroup>
                    </InputOTP>
                </FormControl>
                </FormItem>
            )}
            />
          </div>

          <p className="text-sm self-end">
            Resend Code in <span className="text-blue-400 font-medium">{timer}s</span>
          </p>
          <Button type="submit" className="w-full max-w-sm mb-4" disabled={isLoading}>
            {isLoading? "Verifying" : "Verify"}
          </Button>
        </form>
      </Form>

      <p className="text-sm text-gray-400 self-center">
        Already have an account? <a href="/login" className="text-blue-400 font-medium">Sign In</a>
      </p>
    </div>
  );
}
