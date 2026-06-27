import { DashboardGreeting } from "@/components/dashboard-greeting"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardStats } from "@/components/dashboard-stats"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const activeRole = await getUserRole(user)
  const isExcludedRole = activeRole === "Viewer" || activeRole === "Member"

  let users: any[] = []
  let errorMsg: string | null = null

  if (!isExcludedRole) {
    try {
      const adminSupabase = createAdminClient()
      const { data, error } = await adminSupabase.auth.admin.listUsers()
      if (error) {
        errorMsg = error.message
      } else {
        users = data?.users || []
      }
    } catch (e: any) {
      errorMsg = e.message || "Failed to retrieve user statistics."
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
      <DashboardGreeting />
      {!isExcludedRole && (
        <DashboardStats initialUsers={users} error={errorMsg} />
      )}
    </div>
  )
}

