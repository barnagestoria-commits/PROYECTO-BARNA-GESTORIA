"use client"

import { Suspense, useCallback, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AppTopNav } from "@/components/layout/app-top-nav"
import { CommandPalette } from "@/components/command-palette"
import { getPageTitle } from "@/lib/navigation/accounting-toolbar"
import { getPageBreadcrumb } from "@/lib/navigation/page-meta"

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
  panelTitle,
  onLogout,
}: SidebarLayoutProps) {
  const pathname = usePathname()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])

  const pageTitle = getPageTitle(pathname)
  const breadcrumb = getPageBreadcrumb(pathname)
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
        <div className="px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-pine-900">
            {isDashboardHome ? panelTitle : pageTitle}
          </h1>
          <p className="mt-1 text-sm text-graphite-500">{breadcrumb}</p>
        </div>
      </header>

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
