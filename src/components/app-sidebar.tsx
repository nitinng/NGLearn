"use client"

import * as React from "react"
import {
  BookOpen,
  LifeBuoy,
  Send,
  LayoutDashboard,
  GalleryVerticalEnd,
  Users,
  GraduationCap,
  Database,
  DatabaseBackup,
  Trophy,
  Briefcase,
  CalendarClock,
  HeartHandshake,
  BarChart,
  Settings,
  TrendingUp,
} from "lucide-react"

import { NavMain, NavItem } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { useUserContext } from "@/contexts/user-context"

const data = {}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile, isMobile } = useSidebar()
  const user = useUserContext()

  const navGeneral: NavItem[] = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      isActive: true,
    },
  ];


  const navManage: NavItem[] = [
    {
      title: "Published Reports",
      url: "/published-reports",
      icon: BookOpen,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const navContests: NavItem[] = [
    {
      title: "All Contests",
      url: "/contests",
      icon: Trophy,
    },
  ];


  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                href="/"
                onClick={() => {
                  if (isMobile) setOpenMobile(false)
                }}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">NGLearn</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.role ? `${user.role} Workspace` : "Workspace"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={[...navGeneral, ...navContests, ...navManage]} />
      </SidebarContent>
    </Sidebar>
  )
}
