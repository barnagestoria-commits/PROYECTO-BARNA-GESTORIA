"use client"

import Link from "next/link"
import { Command, MessageCircle, Search } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"
import { ModuleNavBar } from "@/components/layout/module-nav-bar"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu"
import { OnboardingHelpMenu } from "@/components/onboarding/onboarding-help-menu"
import { cn } from "@/lib/utils"
import { getSidebarNavModules } from "@/lib/navigation/sidebar-nav"

interface AppTopNavProps {
  onLogout: () => void
  userName: string
  onOpenCommandPalette?: () => void
}

export function AppTopNav({ onLogout, userName, onOpenCommandPalette }: AppTopNavProps) {
  const { session } = useAuth()
  const sidebarModules = getSidebarNavModules(session?.user.accountType ?? "CLIENTE_FINAL")

  return (
    <header
      data-tour="accounting-toolbar"
      className="sticky top-0 z-50 shrink-0 border-b border-emerald-950/30 bg-[#141a17] text-white shadow-sm"
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-white/5"
          aria-label="Ir al dashboard principal"
        >
          <ResponsiveLogo size="sm" className="brightness-110" />
          <div className="min-w-0 hidden sm:block">
            <p className="truncate text-sm font-bold text-white">Barna Gestoría</p>
            <p className="truncate text-[11px] text-white/45">Panel financiero</p>
          </div>
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className={cn(
                "hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex",
              )}
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Buscar</span>
              <kbd className="hidden rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70 lg:inline-flex lg:items-center lg:gap-0.5">
                <Command className="h-3 w-3" />
                K
              </kbd>
            </button>
          )}

          <SidebarCompanySelector userName={userName} className="hidden max-w-[220px] md:block" />

          <SidebarUserMenu
            userName={userName}
            onLogout={onLogout}
            placement="top"
            compact
          />

            <OnboardingHelpMenu />

          <Link
            href="/contact"
            className="rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            title="Chat / Soporte"
            aria-label="Chat de soporte"
          >
            <MessageCircle className="h-4 w-4" />
          </Link>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="rounded-lg p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <ModuleNavBar modules={sidebarModules} />
    </header>
  )
}
