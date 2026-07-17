"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { A3Toolbar } from "@/components/a3-toolbar"
import { CompanySelector } from "@/components/company-selector"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useRequireAuth } from "@/components/auth-provider"
import { getPageTitle } from "@/lib/navigation/a3-toolbar"
import { DashboardOnboardingTour } from "@/components/dashboard-onboarding-tour"
import { BookOpen, Loader2, LogOut } from "lucide-react"

interface DashboardShellProps {
  children: ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname()
  const { session, panelTitle, roleLabel, activeCompany, logout, isLoading } = useRequireAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const pageTitle = getPageTitle(pathname)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="sm" />
            <div>
              <h1 className="text-lg font-bold text-emerald-800 md:text-xl">
                {pageTitle} — {panelTitle}
              </h1>
              <p className="text-xs text-gray-500">
                {session.user.name} • {roleLabel}
                {activeCompany && ` • ${activeCompany.name}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CompanySelector />
            {pathname !== "/dashboard/contabilidad" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/contabilidad">
                  <BookOpen className="mr-1 h-4 w-4" />
                  Asientos
                </Link>
              </Button>
            )}
            {pathname !== "/dashboard" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">Documentos</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <A3Toolbar />

      <DashboardOnboardingTour enabled={pathname === "/dashboard"} />

      <main className="container mx-auto max-w-full overflow-x-hidden px-4 py-6 md:py-8">{children}</main>
    </div>
  )
}
