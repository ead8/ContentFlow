import { Suspense } from "react"
import LoginForm from "@/components/auth/login_form"

export const metadata = { title: "Sign in" }

export default function Page() {
  return (
    <div className="flex items-center justify-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
