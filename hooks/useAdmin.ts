import { useAuth } from "@/components/auth-provider"

export function useAdmin() {
  const { user } = useAuth()
  // Only users with admin role should have access
  return user?.role === "admin"
}
