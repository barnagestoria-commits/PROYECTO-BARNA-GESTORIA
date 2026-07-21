"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { HelpCircle, MessageCircle } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarFlyoutPanel } from "@/components/layout/sidebar-flyout-panel"
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import {
  SIDEBAR_NAV_MODULES,
  SIDEBAR_WIDTH_CLASS,
  getActiveModuleId,
  isSidebarModuleActive,
  type SidebarNavModule,
} from "@/lib/navigation/sidebar-nav"

const FLYOUT_CLOSE_DELAY_MS = 200

interface FlyoutPosition {
  top: number
  left: number
}

interface AppSidebarProps {
  onLogout: () => void
  userName: string
}

export function AppSidebar({ onLogout, userName }: AppSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<FlyoutPosition | null>(null)

  const openModule = SIDEBAR_NAV_MODULES.find((m) => m.id === hoveredModuleId)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const closeFlyout = useCallback(() => {
    clearCloseTimer()
    setHoveredModuleId(null)
    setFlyoutPosition(null)
  }, [clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(closeFlyout, FLYOUT_CLOSE_DELAY_MS)
  }, [clearCloseTimer, closeFlyout])

  const openFlyoutForModule = useCallback(
    (module: SidebarNavModule, element: HTMLElement) => {
      if (!module.sections?.length) {
        closeFlyout()
        return
      }
      clearCloseTimer()
      const rect = element.getBoundingClientRect()
      setFlyoutPosition({
        top: rect.top,
        left: rect.right + 4,
      })
      setHoveredModuleId(module.id)
    },
    [clearCloseTimer, closeFlyout],
  )

  const itemClassName = (isActive: boolean, isOpen: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
      isActive || isOpen
        ? "bg-emerald-800/40 text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white",
    )

  return (
    <>
      <aside
        className={cn(
          SIDEBAR_WIDTH_CLASS,
          "relative hidden shrink-0 flex-col bg-[#141a17] text-white lg:flex",
        )}
      >
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

        <div className="border-b border-white/5 px-3 py-3">
          <SidebarCompanySelector />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Módulos principales">
          <ul className="space-y-0.5">
            {SIDEBAR_NAV_MODULES.map((module) => {
              const Icon = module.icon
              const isActive = isSidebarModuleActive(module, pathname, searchString)
              const isOpen = hoveredModuleId === module.id
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
                  {module.href && !hasFlyout && (
                    <Link href={module.href} className={itemClassName(isActive, isOpen)}>
                      {itemContent}
                    </Link>
                  )}

                  {module.href && hasFlyout && (
                    <Link
                      href={module.href}
                      className={itemClassName(isActive, isOpen)}
                      onMouseEnter={(e) => openFlyoutForModule(module, e.currentTarget)}
                      onMouseLeave={scheduleClose}
                      onClick={closeFlyout}
                    >
                      {itemContent}
                    </Link>
                  )}

                  {!module.href && hasFlyout && (
                    <button
                      type="button"
                      className={itemClassName(isActive, isOpen)}
                      onMouseEnter={(e) => openFlyoutForModule(module, e.currentTarget)}
                      onMouseLeave={scheduleClose}
                      onClick={(e) => openFlyoutForModule(module, e.currentTarget)}
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
        </nav>

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
              <SidebarUserMenu userName={userName} onLogout={onLogout} />
            </li>
          </ul>
        </div>
      </aside>

      {/* Flyout en posición fija para evitar recorte por overflow del nav */}
      {openModule?.sections?.length && flyoutPosition && (
        <div
          className="fixed z-[100] hidden lg:block"
          style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <div className="absolute -left-2 top-0 h-full w-2" aria-hidden="true" />
          <SidebarFlyoutPanel module={openModule} onNavigate={closeFlyout} />
        </div>
      )}
    </>
  )
}
