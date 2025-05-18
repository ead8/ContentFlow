"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { useRouter } from "next/navigation";

// Zod schema
const formSchema = z.object({
  otp: z.string().min(4, {
    message: "Your otp password must be 4 characters.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function OTPVerificationForm() {
  const router = useRouter();
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
  const onSubmit = (data: FormValues) => {
    router.push('/setPassword')
  };

  return (
    <div className="flex flex-col gap-4">
      <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()}/>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">OTP Verification Required</h1>
        <p className="text-sm">
            Please enter OTP sent to <span className="text-blue-400">sam_chris@gmail.com</span>
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
                    <InputOTP {...field} maxLength={4} className="w-full">
                        <InputOTPGroup className="w-full">
                            <InputOTPSlot index={0} className="w-full"/>
                            <InputOTPSlot index={1} className="w-full"/>
                            <InputOTPSlot index={2} className="w-full"/>
                            <InputOTPSlot index={3} className="w-full"/>
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
          <Button type="submit" className="w-full max-w-sm mb-4">
            Submit
          </Button>
        </form>
      </Form>

      <p className="text-sm text-gray-400 self-center">
        Already have an account? <a href="/login" className="text-blue-400 font-medium">Sign In</a>
      </p>
    </div>
  );
}
