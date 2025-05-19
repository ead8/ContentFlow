"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "../ui";
import { useAuth } from "../auth-provider";
import { useToast } from "@/hooks/use-toast";

// Zod schema
const formSchema = z
  .object({
    email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  })
  


type FormValues = z.infer<typeof formSchema>;

export default function ResetPasswordForm() {
  const router = useRouter();
  const { reset } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  // Submission
  const onSubmit = async(data: FormValues) => {
    try {
      await reset(data.email)
      toast({
        title: "Check your email",
        description: "We have sent you a password reset link. Please check your inbox.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while resetting your password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()}/>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Reset Password</h1>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
          <div className="w-full flex flex-col gap-4">
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
            </div>
          <Button type="submit" className="w-full max-w-sm my-4" disabled={!form.formState.isValid}>
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