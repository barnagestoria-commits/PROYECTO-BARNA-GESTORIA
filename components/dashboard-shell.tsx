"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { SidebarLayout } from "@/components/layout/sidebar-layout"
import { useRequireAuth } from "@/components/auth-provider"

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { session, panelTitle, roleLabel, activeCompany, logout, isLoading } = useRequireAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <SidebarLayout
      userName={session.user.name}
      roleLabel={roleLabel}
      companyName={activeCompany?.name}
      panelTitle={panelTitle}
      onLogout={() => logout()}
    >
      {children}
    </SidebarLayout>
  )
}
