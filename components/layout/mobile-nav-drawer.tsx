"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown, HelpCircle, MessageCircle, X } from "lucide-react"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { useAuth } from "@/components/auth-provider"
import { SidebarCompanySelector } from "@/components/layout/sidebar-company-selector"
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu"
import { cn } from "@/lib/utils"
import { startOnboardingTour } from "@/lib/onboarding"
import {
  getSidebarNavModules,
  isNavLinkActive,
  isSidebarModuleActive,
} from "@/lib/navigation/sidebar-nav"

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
  onLogout: () => void
  userName: string
}

export function MobileNavDrawer({ open, onClose, onLogout, userName }: MobileNavDrawerProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const { session } = useAuth()

  const sidebarModules = getSidebarNavModules(session?.user.accountType ?? "CLIENTE_FINAL")

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const active = sidebarModules.find((m) =>
      isSidebarModuleActive(m, pathname, searchString),
    )
    if (active?.sections?.length) {
      setExpandedModuleId(active.id)
    }
  }, [open, pathname, searchString, sidebarModules])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar menú"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 left-0 flex w-[min(100vw,320px)] flex-col bg-[#141a17] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <ResponsiveLogo size="sm" />
            <span className="text-sm font-bold">Barna Gestoría</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white"
            aria-label="Cerrar navegación"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/5 px-3 py-3 space-y-2">
          <SidebarUserMenu
            userName={userName}
            onLogout={onLogout}
            variant="mobile"
            placement="top"
            onNavigate={onClose}
          />
          <SidebarCompanySelector userName={userName} />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación móvil">
          <ul className="space-y-1">
            {sidebarModules.map((module) => {
              const Icon = module.icon
              const isActive = isSidebarModuleActive(module, pathname, searchString)
              const isExpanded = expandedModuleId === module.id
              const hasSections = Boolean(module.sections?.length)

              if (module.href && !hasSections) {
                return (
                  <li key={module.id}>
                    <Link
                      href={module.href}
                      onClick={onClose}
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

              if (module.href && hasSections) {
                return (
                  <li key={module.id} className="overflow-hidden rounded-lg border border-white/5">
                    <div className="flex items-stretch">
                      <Link
                        href={module.href}
                        onClick={onClose}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 px-3 py-3",
                          isActive ? "bg-emerald-800/30 text-white" : "text-white/75 hover:bg-white/5",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate font-medium">{module.label}</span>
                      </Link>
                      <button
                        type="button"
                        className="border-l border-white/5 px-3 text-white/60 hover:bg-white/5"
                        onClick={() => setExpandedModuleId(isExpanded ? null : module.id)}
                        aria-expanded={isExpanded}
                        aria-label={`Más opciones de ${module.label}`}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    </div>
                    {isExpanded && module.sections && (
                      <div className="border-t border-white/5 bg-white/[0.03] px-2 py-2">
                        {module.sections.map((section) => (
                          <div key={section.title} className="mb-3 last:mb-0">
                            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                              {section.title}
                            </p>
                            <ul className="space-y-0.5">
                              {section.items.map((item) => {
                                const linkActive = isNavLinkActive(item.href, pathname, searchString)
                                return (
                                  <li key={`${section.title}-${item.label}`}>
                                    <Link
                                      href={item.href}
                                      onClick={onClose}
                                      className={cn(
                                        "block rounded-md px-2 py-2 text-sm transition-colors",
                                        linkActive
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
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                )
              }

              return (
                <li key={module.id} className="overflow-hidden rounded-lg border border-white/5">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-3 text-left",
                      isActive || isExpanded ? "bg-emerald-800/30 text-white" : "text-white/75",
                    )}
                    onClick={() =>
                      setExpandedModuleId(isExpanded ? null : module.id)
                    }
                    aria-expanded={isExpanded}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="font-medium">{module.label}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {isExpanded && module.sections && (
                    <div className="border-t border-white/5 bg-white/[0.03] px-2 py-2">
                      {module.sections.map((section) => (
                        <div key={section.title} className="mb-3 last:mb-0">
                          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                            {section.title}
                          </p>
                          <ul className="space-y-0.5">
                            {section.items.map((item) => {
                              const linkActive = isNavLinkActive(item.href, pathname, searchString)
                              return (
                                <li key={`${section.title}-${item.label}`}>
                                  <Link
                                    href={item.href}
                                    onClick={onClose}
                                    className={cn(
                                      "block rounded-md px-2 py-2 text-sm transition-colors",
                                      linkActive
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
                              )
                            })}
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

        <div className="border-t border-white/5 px-2 py-3">
          <button
            type="button"
            onClick={() => {
              startOnboardingTour()
              onClose()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:bg-white/5"
          >
            <HelpCircle className="h-4 w-4" />
            Ayuda
          </button>
          <Link
            href="/contact"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:bg-white/5"
          >
            <MessageCircle className="h-4 w-4" />
            Soporte
          </Link>
        </div>
      </div>
    </div>
  )
}
