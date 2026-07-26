"use client"

import { Suspense, useCallback, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AppTopNav } from "@/components/layout/app-top-nav"
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette"
import { DashboardOnboardingTour } from "@/components/dashboard-onboarding-tour"
import { getPageTitle } from "@/lib/navigation/accounting-toolbar"

interface SidebarLayoutProps {
  children: ReactNode
  userName: string
  roleLabel: string
  companyName?: string
  panelTitle: string
  onLogout: () => void
}

function SidebarLayoutInner({
  children,
  userName,
  roleLabel,
  companyName,
  panelTitle,
  onLogout,
}: SidebarLayoutProps) {
  const pathname = usePathname()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])

  const pageTitle = getPageTitle(pathname)
  const isDashboardHome = pathname === "/dashboard"

  return (
    <div className="flex min-h-screen flex-col bg-sand-50/80">
      <Suspense fallback={null}>
        <AppTopNav
          onLogout={onLogout}
          userName={userName}
          onOpenCommandPalette={openCommandPalette}
        />
      </Suspense>

      <header className="shrink-0 border-b border-sand-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-pine-900">
              {isDashboardHome ? panelTitle : pageTitle}
            </h1>
            <p className="mt-0.5 text-sm text-graphite-500">
              {userName} · {roleLabel}
              {companyName && ` · ${companyName}`}
            </p>
          </div>
          <CommandPaletteTrigger onOpen={openCommandPalette} />
        </div>
      </header>

      <DashboardOnboardingTour enabled={pathname === "/dashboard"} />

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </main>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}

export function SidebarLayout(props: SidebarLayoutProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-sand-50">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      }
    >
      <SidebarLayoutInner {...props} />
    </Suspense>
  )
}
