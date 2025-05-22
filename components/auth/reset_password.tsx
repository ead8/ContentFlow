"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "../ui";
import { useAuth } from "../auth-provider";
import { useToast } from "@/hooks/use-toast";

// Zod schema
const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ResetPasswordForm() {
  const router = useRouter();
  const { reset } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsLoading(true);
      const { error } = await reset(data.email);
      if (error) throw error;

      toast({
        title: "Check your email",
        description: "We have sent you a password reset link. Please check your inbox.",
      });

      setIsEmailSent(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while resetting your password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto px-6 pt-6">
        {/* <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()} /> */}
        <div className="flex flex-col items-center gap-4 p-8 border rounded-lg">
          <MailCheck className="w-12 h-12 text-green-500" />
          <h2 className="text-xl font-semibold">Email Sent!</h2>
          <p className="text-center text-gray-700">
            We have sent a password reset link to your email. Please check your inbox and follow the instructions.
          </p>
          <Button onClick={() => router.push("/login")}>Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto px-6 pt-6 lg:p-0">
      <ArrowLeft className="w-6 h-6 cursor-pointer" onClick={() => router.back()} />
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enter your Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input {...field} placeholder="Email" className="pr-10 w-96" />
                    <MailCheck className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading || !form.formState.isValid}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </form>
      </Form>
      <p className="text-sm text-gray-400 self-center">
        Already have an account?{" "}
        <a href="/login" className="text-blue-400 font-medium">
          Sign In
        </a>
      </p>
    </div>
  );
}
