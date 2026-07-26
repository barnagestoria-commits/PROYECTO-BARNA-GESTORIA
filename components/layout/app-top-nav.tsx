"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, HelpCircle, MessageCircle } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarFlyoutPanel } from "@/components/layout/sidebar-flyout-panel"
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import {
  getSidebarNavModules,
  isSidebarModuleActive,
  type SidebarNavModule,
} from "@/lib/navigation/sidebar-nav"

interface AppTopNavProps {
  onLogout: () => void
  userName: string
  onOpenCommandPalette?: () => void
}

export function AppTopNav({ onLogout, userName, onOpenCommandPalette }: AppTopNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const navRef = useRef<HTMLElement>(null)
  const { session } = useAuth()

  const sidebarModules = getSidebarNavModules(session?.user.accountType ?? "CLIENTE_FINAL")
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)

  const closeDropdown = useCallback(() => setOpenModuleId(null), [])

  const toggleModule = useCallback((module: SidebarNavModule) => {
    if (!module.sections?.length) {
      closeDropdown()
      return
    }
    setOpenModuleId((current) => (current === module.id ? null : module.id))
  }, [closeDropdown])

  useEffect(() => {
    closeDropdown()
  }, [pathname, searchString, closeDropdown])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDropdown()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [closeDropdown])

  const moduleClassName = (isActive: boolean, isOpen: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:text-[11px]",
      isActive || isOpen
        ? "bg-emerald-800/90 text-white shadow-inner"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    )

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 hidden shrink-0 border-b border-emerald-950/40 bg-[#141a17] text-white lg:block"
    >
      <div className="border-b border-white/5">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-white/5"
            aria-label="Ir al dashboard principal"
          >
            <ResponsiveLogo size="sm" className="brightness-110" />
            <div className="min-w-0 hidden xl:block">
              <p className="truncate text-sm font-bold text-white">Barna Gestoría</p>
              <p className="truncate text-[11px] text-white/45">Panel financiero</p>
            </div>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SidebarCompanySelector userName={userName} className="max-w-[220px]" />
            <SidebarUserMenu userName={userName} onLogout={onLogout} placement="top" />
            <button
              type="button"
              onClick={() => startOnboardingTour()}
              className="hidden rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white xl:inline-flex"
              title="Ayuda"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <Link
              href="/contact"
              className="hidden rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white xl:inline-flex"
              title="Soporte"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                ⌘K
              </button>
            )}
          </div>
        </div>
      </div>

      <nav
        className="mx-auto max-w-[1600px] overflow-x-auto px-2 py-1 scrollbar-none"
        aria-label="Módulos principales"
      >
        <ul className="flex min-w-max items-stretch gap-0.5">
          {sidebarModules.map((module) => {
            const Icon = module.icon
            const isActive = isSidebarModuleActive(module, pathname, searchString)
            const isOpen = openModuleId === module.id
            const hasFlyout = Boolean(module.sections?.length)

            const itemContent = (
              <>
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive || isOpen ? "text-emerald-300" : "text-white/55",
                  )}
                />
                <span className="whitespace-nowrap">{module.label}</span>
                {hasFlyout && (
                  <ChevronDown
                    className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
                  />
                )}
              </>
            )

            return (
              <li key={module.id} className="relative shrink-0">
                {module.href && !hasFlyout && (
                  <Link href={module.href} className={moduleClassName(isActive, isOpen)}>
                    {itemContent}
                  </Link>
                )}

                {module.href && hasFlyout && (
                  <div className="flex items-stretch">
                    <Link
                      href={module.href}
                      className={cn(moduleClassName(isActive, isOpen), "rounded-r-none pr-2")}
                      onClick={closeDropdown}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive || isOpen ? "text-emerald-300" : "text-white/55",
                        )}
                      />
                      <span className="whitespace-nowrap">{module.label}</span>
                    </Link>
                    <button
                      type="button"
                      className={cn(
                        moduleClassName(isActive, isOpen),
                        "rounded-l-none border-l border-white/10 px-2",
                      )}
                      onClick={() => toggleModule(module)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      aria-label={`Abrir menú de ${module.label}`}
                    >
                      <ChevronDown
                        className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
                      />
                    </button>
                  </div>
                )}

                {!module.href && hasFlyout && (
                  <button
                    type="button"
                    className={moduleClassName(isActive, isOpen)}
                    onClick={() => toggleModule(module)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                  >
                    {itemContent}
                  </button>
                )}

                {isOpen && hasFlyout && (
                  <div className="absolute left-0 top-full z-50 mt-1">
                    <SidebarFlyoutPanel
                      module={module}
                      onNavigate={closeDropdown}
                      variant="dropdown"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
