"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, HelpCircle, Menu, MessageCircle, X } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarFlyoutPanel } from "@/components/layout/sidebar-flyout-panel"
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import {
  getSidebarNavModules,
  isNavLinkActive,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileExpandedModuleId, setMobileExpandedModuleId] = useState<string | null>(null)

  const closeDropdown = useCallback(() => setOpenModuleId(null), [])
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
    setMobileExpandedModuleId(null)
  }, [])

  const toggleModule = useCallback((module: SidebarNavModule) => {
    if (!module.sections?.length) {
      closeDropdown()
      return
    }
    setOpenModuleId((current) => (current === module.id ? null : module.id))
  }, [closeDropdown])

  useEffect(() => {
    closeDropdown()
    closeMobileMenu()
  }, [pathname, searchString, closeDropdown, closeMobileMenu])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown()
        closeMobileMenu()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [closeDropdown, closeMobileMenu])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

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
      data-tour="accounting-toolbar"
      className="sticky top-0 z-50 shrink-0 border-b border-emerald-950/40 bg-[#141a17] text-white"
    >
      <div className="border-b border-white/5">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-white/5"
            aria-label="Ir al dashboard principal"
          >
            <ResponsiveLogo size="sm" className="brightness-110" />
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-sm font-bold text-white">Barna Gestoría</p>
              <p className="truncate text-[11px] text-white/45">Panel financiero</p>
            </div>
          </Link>

          <nav
            className="hidden min-w-0 flex-1 overflow-x-auto px-1 scrollbar-none lg:block"
            aria-label="Módulos principales"
          >
            <ul className="flex min-w-max items-stretch gap-0.5">
              {sidebarModules.map((module) => (
                <DesktopNavItem
                  key={module.id}
                  module={module}
                  pathname={pathname}
                  searchString={searchString}
                  isOpen={openModuleId === module.id}
                  onToggle={() => toggleModule(module)}
                  onClose={closeDropdown}
                  moduleClassName={moduleClassName}
                />
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SidebarCompanySelector userName={userName} className="hidden max-w-[220px] md:block" />
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

      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-[#141a17] lg:hidden">
          <div className="mx-auto max-h-[min(70vh,560px)] max-w-[1600px] overflow-y-auto px-3 py-3">
            <div className="mb-3 md:hidden">
              <SidebarCompanySelector userName={userName} />
            </div>
            <nav aria-label="Navegación móvil">
              <ul className="space-y-1">
                {sidebarModules.map((module) => {
                  const Icon = module.icon
                  const isActive = isSidebarModuleActive(module, pathname, searchString)
                  const isExpanded = mobileExpandedModuleId === module.id
                  const hasSections = Boolean(module.sections?.length)

                  if (module.href && !hasSections) {
                    return (
                      <li key={module.id}>
                        <Link
                          href={module.href}
                          onClick={closeMobileMenu}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3",
                            isActive ? "bg-emerald-800/40 text-white" : "text-white/75 hover:bg-white/5",
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium">{module.label}</span>
                        </Link>
                      </li>
                    )
                  }

                  return (
                    <li key={module.id} className="overflow-hidden rounded-lg border border-white/5">
                      <div className="flex items-stretch">
                        {module.href ? (
                          <Link
                            href={module.href}
                            onClick={closeMobileMenu}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-3 px-3 py-3",
                              isActive ? "bg-emerald-800/30 text-white" : "text-white/75 hover:bg-white/5",
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="truncate font-medium">{module.label}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left",
                              isActive ? "bg-emerald-800/30 text-white" : "text-white/75",
                            )}
                            onClick={() =>
                              setMobileExpandedModuleId(isExpanded ? null : module.id)
                            }
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="truncate font-medium">{module.label}</span>
                          </button>
                        )}
                        {hasSections && (
                          <button
                            type="button"
                            className="border-l border-white/5 px-3 text-white/60 hover:bg-white/5"
                            onClick={() =>
                              setMobileExpandedModuleId(isExpanded ? null : module.id)
                            }
                            aria-expanded={isExpanded}
                            aria-label={`Desplegar ${module.label}`}
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                            />
                          </button>
                        )}
                      </div>

                      {isExpanded && module.sections && (
                        <div className="border-t border-white/5 bg-white/[0.03] px-2 py-2">
                          {module.sections.map((section) => (
                            <div key={section.title} className="mb-3 last:mb-0">
                              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                                {section.title}
                              </p>
                              <ul className="space-y-0.5">
                                {section.items.map((item) => (
                                  <li key={`${section.title}-${item.label}`}>
                                    <Link
                                      href={item.href}
                                      onClick={closeMobileMenu}
                                      className={cn(
                                        "block rounded-md px-2 py-2 text-sm transition-colors",
                                        isNavLinkActive(item.href, pathname, searchString)
                                          ? "bg-emerald-800/50 text-white"
                                          : "text-white/70 hover:bg-white/5 hover:text-white",
                                      )}
                                    >
                                      <span className="font-medium">{item.label}</span>
                                      {item.description && (
                                        <span className="mt-0.5 block text-xs text-white/45">
                                          {item.description}
                                        </span>
                                      )}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}

function DesktopNavItem({
  module,
  pathname,
  searchString,
  isOpen,
  onToggle,
  onClose,
  moduleClassName,
}: {
  module: SidebarNavModule
  pathname: string
  searchString: string
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  moduleClassName: (isActive: boolean, isOpen: boolean) => string
}) {
  const Icon = module.icon
  const isActive = isSidebarModuleActive(module, pathname, searchString)
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
    <li className="relative shrink-0">
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
            onClick={onClose}
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
            onClick={onToggle}
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
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {itemContent}
        </button>
      )}

      {isOpen && hasFlyout && (
        <div className="absolute left-0 top-full z-50 mt-1">
          <SidebarFlyoutPanel module={module} onNavigate={onClose} variant="dropdown" />
        </div>
      )}
    </li>
  )
}
