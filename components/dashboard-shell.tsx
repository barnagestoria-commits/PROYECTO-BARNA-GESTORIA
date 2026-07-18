"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { A3Toolbar } from "@/components/a3-toolbar"
import { CompanySelector } from "@/components/company-selector"
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette"
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])

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
  const isDashboardHome = pathname === "/dashboard"

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b bg-white">
        <div className="container mx-auto flex max-w-full flex-col gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-start gap-2 md:items-center md:gap-3">
            <ResponsiveLogo size="sm" />
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-snug text-emerald-800 sm:text-lg md:text-xl">
                <span className="break-words">{isDashboardHome ? panelTitle : pageTitle}</span>
                {!isDashboardHome && (
                  <span className="mt-0.5 block text-sm font-medium text-gray-600 sm:mt-0 sm:inline sm:font-bold sm:text-emerald-800">
                    <span className="hidden sm:inline"> — </span>
                    {panelTitle}
                  </span>
                )}
              </h1>
              <p className="mt-1 break-words text-xs leading-relaxed text-gray-500">
                {session.user.name} • {roleLabel}
                {activeCompany && ` • ${activeCompany.name}`}
              </p>
            </div>
          </div>

          <div className="w-full">
            <CommandPaletteTrigger onOpen={openCommandPalette} />
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <CompanySelector />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              {pathname !== "/dashboard/contabilidad" && (
                <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" asChild>
                  <Link href="/dashboard/contabilidad">
                    <BookOpen className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate">Asientos</span>
                  </Link>
                </Button>
              )}
              {pathname !== "/dashboard" && (
                <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" asChild>
                  <Link href="/dashboard">Documentos</Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="col-span-2 h-9 w-full sm:col-span-1 sm:w-auto"
                onClick={() => logout()}
              >
                <LogOut className="mr-2 h-4 w-4 shrink-0" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <A3Toolbar />

      <DashboardOnboardingTour enabled={pathname === "/dashboard"} />

      <main className="container mx-auto min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:py-6 md:py-8">
        {children}
      </main>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}
