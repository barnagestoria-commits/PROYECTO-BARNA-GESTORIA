"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useCallback, useState, type ReactNode } from "react"
import { Loader2, Menu } from "lucide-react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { DashboardOnboardingTour } from "@/components/dashboard-onboarding-tour"
import { getPageTitle } from "@/lib/navigation/a3-toolbar"

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])

  const pageTitle = getPageTitle(pathname)
  const isDashboardHome = pathname === "/dashboard"

  return (
    <div className="flex min-h-screen bg-sand-50/80">
      <Suspense fallback={null}>
        <AppSidebar onLogout={onLogout} userName={userName} />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header móvil / tableta */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-sand-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-pine-900 hover:bg-sand-100"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
            <ResponsiveLogo size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-pine-900">Barna Gestoría</p>
              {companyName && (
                <p className="truncate text-xs text-graphite-500">{companyName}</p>
              )}
            </div>
          </Link>
        </header>

        {/* Barra superior escritorio */}
        <header className="hidden shrink-0 border-b border-sand-200 bg-white lg:block">
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-pine-900">
                  {isDashboardHome ? panelTitle : pageTitle}
                </h1>
                <p className="mt-0.5 text-sm text-graphite-500">
                  {userName} · {roleLabel}
                  {companyName && ` · ${companyName}`}
                </p>
              </div>
            </div>
            <CommandPaletteTrigger onOpen={openCommandPalette} />
          </div>
        </header>

        {/* Command palette móvil */}
        <div className="border-b border-sand-200 bg-white px-4 py-2 lg:hidden">
          <CommandPaletteTrigger onOpen={openCommandPalette} />
        </div>

        <DashboardOnboardingTour enabled={pathname === "/dashboard"} />

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          onLogout={onLogout}
          userName={userName}
        />
      </Suspense>

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
