"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Scale,
  Stamp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { A3_TOOLBAR_GROUPS, type A3ToolbarGroup } from "@/lib/navigation/a3-toolbar"
import { startOnboardingTour } from "@/lib/onboarding"
import { downloadReportExcel, downloadReportPdf } from "@/lib/reports/download-client"
import { HelpCircle } from "lucide-react"

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

export function A3Toolbar() {
  const pathname = usePathname()
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const closeMenus = useCallback(() => setOpenGroupId(null), [])

  const handlePdfDownload = async (itemId: string, reportType: NonNullable<typeof A3_TOOLBAR_GROUPS[0]["items"][0]["pdfReportType"]>) => {
    setDownloadingId(itemId)
    try {
      await downloadReportPdf(reportType)
      closeMenus()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : "No se pudo generar el PDF.")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleExcelDownload = async (itemId: string, reportType: NonNullable<typeof A3_TOOLBAR_GROUPS[0]["items"][0]["pdfReportType"]>) => {
    setDownloadingId(`${itemId}-xlsx`)
    try {
      await downloadReportExcel(reportType)
      closeMenus()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : "No se pudo generar el Excel.")
    } finally {
      setDownloadingId(null)
    }
  }

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
      className="border-b border-emerald-950/30 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950"
    >
      <div className="container mx-auto flex items-stretch gap-1 px-2 sm:px-4">
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
                  <span className="mx-0.5 hidden w-px self-stretch bg-emerald-700/80 sm:block" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:text-[11px]",
                    active || isOpen
                      ? "bg-emerald-700/90 text-white shadow-inner"
                      : "text-emerald-100/90 hover:bg-emerald-800/70 hover:text-white",
                  )}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  <span className="hidden md:inline">{group.label}</span>
                  <span className="md:hidden">{group.shortLabel ?? group.label}</span>
                  <ChevronDown
                    className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 min-w-[280px] max-w-[320px] rounded-md border border-emerald-800/40 bg-white py-1 shadow-xl"
                  >
                    <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {group.label}
                    </p>
                    <ul className="py-1">
                      {group.items.map((item) => {
                        const ItemIcon = ITEM_ICONS[item.id] ?? Download
                        const itemActive = isItemActive(item.href, pathname)

                        return (
                          <li key={item.id} role="none">
                            <div
                              className={cn(
                                "flex items-start gap-1 px-2 py-1.5",
                                itemActive && "bg-emerald-50/80",
                              )}
                            >
                              <Link
                                href={item.href}
                                role="menuitem"
                                className="flex min-w-0 flex-1 items-start gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-emerald-50"
                                onClick={closeMenus}
                              >
                                <ItemIcon
                                  className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0",
                                    itemActive ? "text-emerald-700" : "text-gray-400",
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "block text-sm font-medium",
                                        itemActive ? "text-emerald-900" : "text-gray-900",
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
                                    <span className="mt-0.5 block text-xs text-gray-500">{item.description}</span>
                                  )}
                                </span>
                              </Link>
                              {item.pdfReportType && (
                                <div className="mt-0.5 flex shrink-0 flex-col gap-0.5">
                                  <button
                                    type="button"
                                    title={`Descargar PDF — ${item.label}`}
                                    disabled={downloadingId === item.id}
                                    onClick={() => handlePdfDownload(item.id, item.pdfReportType!)}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {downloadingId === item.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    title={`Exportar Excel — ${item.label}`}
                                    disabled={downloadingId === `${item.id}-xlsx`}
                                    onClick={() => handleExcelDownload(item.id, item.pdfReportType!)}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {downloadingId === `${item.id}-xlsx` ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileSpreadsheet className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={startOnboardingTour}
          className="my-1 flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-emerald-100/90 transition-colors hover:bg-emerald-800/70 hover:text-white"
          title="Ver tutorial de bienvenida"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Tutorial</span>
        </button>
      </div>
    </div>
  )
}
