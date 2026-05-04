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
    <div className="w-full max-w-md mx-auto px-4 py-12 space-y-8">
      <button
        onClick={() => router.back()}
        className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
        <p className="text-muted-foreground">
          We&apos;ve sent a confirmation code to <br />
          <span className="text-accent font-medium">{email}</span>
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="otp"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Enter verification code</FormLabel>
                <FormControl>
                  <InputOTP {...field} maxLength={6} className="flex justify-center">
                    <InputOTPGroup className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="w-12 h-12 border border-input rounded-lg bg-background text-center font-semibold text-lg focus:border-accent focus:ring-1 focus:ring-accent"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
              </FormItem>
            )}
          />

          <div className="text-center text-sm text-muted-foreground">
            {timer > 0 ? (
              <p>
                Resend code in{" "}
                <span className="text-accent font-medium">{timer}s</span>
              </p>
            ) : (
              <button
                type="button"
                className="text-accent hover:text-accent/80 font-medium transition-colors"
              >
                Resend code
              </button>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            disabled={isLoading || form.watch("otp").length !== 6}
          >
            {isLoading ? "Verifying..." : "Verify"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-accent font-medium hover:text-accent/80 transition-colors">
              Sign in
            </a>
          </div>
        </form>
      </Form>
    </div>
  );
}
