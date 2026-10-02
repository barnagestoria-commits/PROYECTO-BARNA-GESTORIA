"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isNavLinkActive,
  isSidebarModuleActive,
  type SidebarNavModule,
} from "@/lib/navigation/sidebar-nav"

interface MobileNavSheetProps {
  open: boolean
  onClose: () => void
  modules: SidebarNavModule[]
}

export function MobileNavSheet({ open, onClose, modules }: MobileNavSheetProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose, open])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
      <button
        type="button"
        className="absolute inset-0 bg-pine-950/45"
        aria-label="Cerrar menú"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 top-[max(0.5rem,env(safe-area-inset-top))] flex flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-sand-200 px-4 py-3">
          <p className="text-base font-semibold text-pine-900">Menú</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-graphite-500 hover:bg-sand-100 hover:text-pine-900"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {modules.map((module) => {
            const Icon = module.icon
            const moduleActive = isSidebarModuleActive(module, pathname, searchString)
            const hasSections = Boolean(module.sections?.length)

            return (
              <section key={module.id} className="mb-4 last:mb-0">
                {module.href ? (
                  <Link
                    href={module.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
                      moduleActive ? "bg-emerald-50 text-emerald-900" : "text-pine-900",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
                    {module.label}
                  </Link>
                ) : (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-pine-900">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
                    {module.label}
                  </p>
                )}

                {hasSections &&
                  module.sections?.map((section) => (
                    <div key={section.title} className="mt-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-graphite-400">
                        {section.title}
                      </p>
                      <ul>
                        {section.items.map((item) => (
                          <li key={`${module.id}-${section.title}-${item.label}`}>
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={cn(
                                "block rounded-lg px-3 py-2.5 text-sm leading-snug",
                                isNavLinkActive(item.href, pathname, searchString)
                                  ? "bg-emerald-50 font-medium text-emerald-900"
                                  : "text-graphite-700 active:bg-sand-50",
                              )}
                            >
                              {item.label}
                              {item.badge ? (
                                <span className="ml-2 rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-800">
                                  {item.badge}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </section>
            )
          })}
        </nav>
      </div>
    </div>,
    document.body,
  )
}
