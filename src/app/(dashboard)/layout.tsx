import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { UserProvider } from "@/contexts/user-context"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Read the dev override from cookies directly
    const cookieStore = await cookies()
    const rawDevOverride = cookieStore.get('dev-role-override')?.value
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const userMetadata = user?.user_metadata || {}
    const displayName = userMetadata.full_name || userMetadata.name || "User"
    const displayEmail = user?.email || "user@example.com"
    const displayAvatar = userMetadata.avatar_url || userMetadata.picture || ""

    return (
        <UserProvider user={{
            id: user?.id || "1",
            name: displayName,
            email: displayEmail,
            avatar: displayAvatar,
        }}>
            <div className="[--header-height:calc(--spacing(14))]">
                <SidebarProvider className="flex flex-col">
                    <SiteHeader />
                    <div className="flex flex-1">
                        <AppSidebar />
                        <SidebarInset>
                            {children}
                        </SidebarInset>
                    </div>
                </SidebarProvider>
            </div>
        </UserProvider>
    )
}
