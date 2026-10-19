import { Suspense } from "react"
import OTPVerification from "@/components/auth/otp_form"

export const metadata = { title: "Verify email" }

export default function Page() {
  return (
    <div className="flex items-center justify-center">
      <Suspense>
        <OTPVerification />
      </Suspense>
    </div>
  )
}
