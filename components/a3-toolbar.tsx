"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronDown,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Scale,
  Stamp,
} from "lucide-react"
import { ReportExportButtons } from "@/components/report-export-buttons"
import { cn } from "@/lib/utils"
import { A3_TOOLBAR_GROUPS, type A3ToolbarGroup } from "@/lib/navigation/a3-toolbar"
import { startOnboardingTour } from "@/lib/onboarding"

const GROUP_ICONS: Record<string, typeof BarChart3> = {
  listados: BarChart3,
  impuestos: FileSpreadsheet,
  certificados: Stamp,
  inmovilizado: Scale,
  utilidades: Download,
}

const ITEM_ICONS: Record<string, typeof Download> = {
  balance: Scale,
  "sumas-saldos": BarChart3,
  pyg: BarChart3,
}

function isGroupActive(group: A3ToolbarGroup, pathname: string): boolean {
  return group.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
}

function isItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard/fiscal") {
    return pathname === "/dashboard/fiscal" || pathname.startsWith("/dashboard/fiscal/")
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ToolbarMenuItems({
  group,
  pathname,
  onNavigate,
  variant,
}: {
  group: A3ToolbarGroup
  pathname: string
  onNavigate: () => void
  variant: "mobile" | "desktop"
}) {
  return (
    <ul className={cn("py-1", variant === "mobile" && "space-y-0.5")}>
      {group.items.map((item) => {
        const ItemIcon = ITEM_ICONS[item.id] ?? Download
        const itemActive = isItemActive(item.href, pathname)

        return (
          <li key={item.id} role="none">
            <div
              className={cn(
                "flex items-start gap-1 px-2 py-1.5",
                itemActive && (variant === "mobile" ? "bg-emerald-900/40" : "bg-emerald-50/80"),
              )}
            >
              <Link
                href={item.href}
                role="menuitem"
                className={cn(
                  "flex min-w-0 flex-1 items-start gap-3 rounded-md px-1 py-1 text-left transition-colors",
                  variant === "mobile" ? "hover:bg-emerald-900/30" : "hover:bg-emerald-50",
                )}
                onClick={onNavigate}
              >
                <ItemIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    itemActive
                      ? variant === "mobile"
                        ? "text-emerald-100"
                        : "text-emerald-700"
                      : variant === "mobile"
                        ? "text-emerald-200/80"
                        : "text-gray-400",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "block text-sm font-medium break-words",
                        itemActive
                          ? variant === "mobile"
                            ? "text-white"
                            : "text-emerald-900"
                          : variant === "mobile"
                            ? "text-emerald-50"
                            : "text-gray-900",
                      )}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  {item.description && (
                    <span
                      className={cn(
                        "mt-0.5 block text-xs break-words",
                        variant === "mobile" ? "text-emerald-100/80" : "text-gray-500",
                      )}
                    >
                      {item.description}
                    </span>
                  )}
                </span>
              </Link>
              {item.pdfReportType && (
                <ReportExportButtons
                  reportType={item.pdfReportType}
                  variant={variant === "mobile" ? "toolbar-mobile" : "toolbar-desktop"}
                />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function A3Toolbar() {
  const pathname = usePathname()
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const closeMenus = useCallback(() => setOpenGroupId(null), [])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        closeMenus()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenus()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [closeMenus])

  useEffect(() => {
    closeMenus()
  }, [pathname, closeMenus])

  return (
    <div
      ref={toolbarRef}
      data-tour="a3-toolbar"
      className="relative z-20 shrink-0 border-b border-emerald-950/30 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950"
    >
      {/* Móvil: acordeón vertical — el menú empuja el contenido, no lo solapa */}
      <div className="container mx-auto flex flex-col gap-2 px-3 py-2 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100/90">
            Consultas y descargas
          </p>
          <button
            type="button"
            onClick={startOnboardingTour}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-100/90 hover:bg-emerald-800/70 hover:text-white"
            title="Ver tutorial de bienvenida"
          >
            <HelpCircle className="h-4 w-4" />
            Tutorial
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {A3_TOOLBAR_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? FileSpreadsheet
            const active = isGroupActive(group, pathname)
            const isOpen = openGroupId === group.id

            return (
              <div key={group.id} className="overflow-hidden rounded-lg border border-emerald-800/50">
                <button
                  type="button"
                  onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    active || isOpen
                      ? "bg-emerald-800 text-white"
                      : "bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800/80",
                  )}
                  aria-expanded={isOpen}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="break-words">{group.shortLabel ?? group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-emerald-800/50 bg-emerald-950/80">
                    <ToolbarMenuItems
                      group={group}
                      pathname={pathname}
                      onNavigate={closeMenus}
                      variant="mobile"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Escritorio: barra horizontal clásica */}
      <div className="container mx-auto hidden items-stretch gap-1 px-2 sm:px-4 md:flex">
        <nav
          className="flex flex-1 items-stretch gap-0.5 overflow-x-auto py-1 scrollbar-none"
          aria-label="Herramientas de consulta y descarga"
        >
          {A3_TOOLBAR_GROUPS.map((group, index) => {
            const Icon = GROUP_ICONS[group.id] ?? FileSpreadsheet
            const active = isGroupActive(group, pathname)
            const isOpen = openGroupId === group.id

            return (
              <div key={group.id} className="relative flex shrink-0 items-stretch">
                {index > 0 && (
                  <span className="mx-0.5 hidden w-px self-stretch bg-emerald-700/80 lg:block" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                  className={cn(
                    "flex min-h-9 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:text-[11px]",
                    active || isOpen
                      ? "bg-emerald-700/90 text-white shadow-inner"
                      : "text-emerald-100/90 hover:bg-emerald-800/70 hover:text-white",
                  )}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  <span className="hidden lg:inline">{group.label}</span>
                  <span className="lg:hidden">{group.shortLabel ?? group.label}</span>
                  <ChevronDown
                    className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 min-w-[280px] max-w-[min(320px,calc(100vw-2rem))] rounded-md border border-emerald-800/40 bg-white py-1 shadow-xl"
                  >
                    <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {group.label}
                    </p>
                    <ToolbarMenuItems
                      group={group}
                      pathname={pathname}
                      onNavigate={closeMenus}
                      variant="desktop"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={startOnboardingTour}
          className="my-1 flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium text-emerald-100/90 transition-colors hover:bg-emerald-800/70 hover:text-white"
          title="Ver tutorial de bienvenida"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Tutorial</span>
        </button>
      </div>
    </div>
  )
}
