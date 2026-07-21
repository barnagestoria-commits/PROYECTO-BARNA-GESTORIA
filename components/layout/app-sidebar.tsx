"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { HelpCircle, LogOut, MessageCircle, User } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarFlyoutPanel } from "@/components/layout/sidebar-flyout-panel"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import {
  SIDEBAR_FOOTER_LINKS,
  SIDEBAR_NAV_MODULES,
  SIDEBAR_WIDTH_CLASS,
  getActiveModuleId,
  isSidebarModuleActive,
  type SidebarNavModule,
} from "@/lib/navigation/sidebar-nav"

const FLYOUT_CLOSE_DELAY_MS = 180

interface AppSidebarProps {
  onLogout: () => void
  userName: string
}

export function AppSidebar({ onLogout, userName }: AppSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const navRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null)
  const [pinnedModuleId, setPinnedModuleId] = useState<string | null>(null)
  const [flyoutTop, setFlyoutTop] = useState(0)

  const activeModuleId = getActiveModuleId(pathname, searchString)
  const openModuleId = pinnedModuleId ?? hoveredModuleId
  const openModule = SIDEBAR_NAV_MODULES.find((m) => m.id === openModuleId)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      if (pinnedModuleId) return
      setHoveredModuleId(null)
    }, FLYOUT_CLOSE_DELAY_MS)
  }, [clearCloseTimer, pinnedModuleId])

  const openFlyoutForModule = useCallback(
    (module: SidebarNavModule, element: HTMLElement) => {
      clearCloseTimer()
      if (module.sections?.length) {
        const navTop = navRef.current?.getBoundingClientRect().top ?? 0
        const itemTop = element.getBoundingClientRect().top
        setFlyoutTop(itemTop - navTop)
        setHoveredModuleId(module.id)
      } else {
        setHoveredModuleId(null)
        setPinnedModuleId(null)
      }
    },
    [clearCloseTimer],
  )

  const handleModuleClick = (module: SidebarNavModule, element: HTMLElement) => {
    if (!module.sections?.length) return
    if (pinnedModuleId === module.id) {
      setPinnedModuleId(null)
      setHoveredModuleId(null)
      return
    }
    openFlyoutForModule(module, element)
    setPinnedModuleId(module.id)
  }

  return (
    <aside
      className={cn(
        SIDEBAR_WIDTH_CLASS,
        "relative hidden shrink-0 flex-col bg-[#141a17] text-white lg:flex",
      )}
    >
      {/* Logo → dashboard principal */}
      <div className="border-b border-white/5 px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-white/5"
          aria-label="Ir al dashboard principal"
        >
          <ResponsiveLogo size="sm" className="brightness-110" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Barna Gestoría</p>
            <p className="truncate text-[11px] text-white/45">Panel financiero</p>
          </div>
        </Link>
      </div>

      {/* Selector empresa */}
      <div className="border-b border-white/5 px-3 py-3">
        <SidebarCompanySelector />
      </div>

      {/* Módulos principales */}
      <nav ref={navRef} className="relative flex-1 overflow-y-auto px-2 py-3" aria-label="Módulos principales">
        <ul className="space-y-0.5">
          {SIDEBAR_NAV_MODULES.map((module) => {
            const Icon = module.icon
            const isActive = isSidebarModuleActive(module, pathname, searchString)
            const isOpen = openModuleId === module.id
            const hasFlyout = Boolean(module.sections?.length)

            const itemContent = (
              <>
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive || isOpen ? "text-emerald-300" : "text-white/55",
                  )}
                />
                <span className="truncate text-sm font-medium">{module.label}</span>
              </>
            )

            return (
              <li key={module.id}>
                {module.href && !hasFlyout ? (
                  <Link
                    href={module.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      isActive
                        ? "bg-emerald-800/40 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {itemContent}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isActive || isOpen
                        ? "bg-emerald-800/40 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                    onMouseEnter={(e) => openFlyoutForModule(module, e.currentTarget)}
                    onMouseLeave={scheduleClose}
                    onClick={(e) => handleModuleClick(module, e.currentTarget)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                  >
                    {itemContent}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {/* Flyout flotante */}
        {openModule?.sections?.length && (
          <div
            className="absolute left-full z-50 ml-1"
            style={{ top: flyoutTop }}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            {/* Puente invisible para el ratón */}
            <div className="absolute -left-2 top-0 h-full w-2" aria-hidden="true" />
            <SidebarFlyoutPanel module={openModule} />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-2 py-3">
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => startOnboardingTour()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              Ayuda
            </button>
          </li>
          <li>
            <Link
              href="/contact"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              Soporte
            </Link>
          </li>
          <li>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80">
              <User className="h-4 w-4 shrink-0 text-emerald-300/80" />
              <span className="truncate">{userName}</span>
            </div>
          </li>
          <li>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Cerrar sesión
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}
