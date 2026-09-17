"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { SidebarFlyoutPanel } from "@/components/layout/sidebar-flyout-panel"
import { cn } from "@/lib/utils"
import {
  HOVER_MENU_PANEL_CLASS,
  MORE_MENU_ID,
  useHoverMenu,
} from "@/lib/navigation/hover-menu"
import {
  isNavLinkActive,
  isSidebarModuleActive,
  type SidebarNavModule,
} from "@/lib/navigation/sidebar-nav"

const ITEM_GAP_PX = 4

interface ModuleNavBarProps {
  modules: SidebarNavModule[]
  className?: string
}

export function ModuleNavBar({ modules, className }: ModuleNavBarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const { openId, scheduleOpen, scheduleClose, toggle, close } = useHoverMenu()

  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreMeasureRef = useRef<HTMLButtonElement>(null)

  const [visibleCount, setVisibleCount] = useState(modules.length)
  const moreOpen = openId === MORE_MENU_ID

  const recalculateVisibleCount = useCallback(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const itemNodes = Array.from(
      measure.querySelectorAll<HTMLElement>("[data-measure-item]"),
    )
    const moreWidth = moreMeasureRef.current?.offsetWidth ?? 72
    const available = container.clientWidth

    if (itemNodes.length === 0) {
      setVisibleCount(0)
      return
    }

    let used = 0
    let count = 0

    for (let index = 0; index < itemNodes.length; index += 1) {
      const width = itemNodes[index].offsetWidth
      const hiddenAfter = itemNodes.length - index - 1
      const reserveMore = hiddenAfter > 0 ? moreWidth + ITEM_GAP_PX : 0

      if (count > 0 && used + width + reserveMore > available) {
        break
      }

      if (used + width > available) {
        count = Math.max(1, count || 1)
        break
      }

      used += width + ITEM_GAP_PX
      count += 1
    }

    setVisibleCount(Math.min(itemNodes.length, Math.max(1, count)))
  }, [])

  useLayoutEffect(() => {
    recalculateVisibleCount()
  }, [modules, recalculateVisibleCount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => recalculateVisibleCount())
    observer.observe(container)
    return () => observer.disconnect()
  }, [recalculateVisibleCount])

  useEffect(() => {
    close()
  }, [pathname, searchString, close])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [close])

  const visibleModules = modules.slice(0, visibleCount)
  const overflowModules = modules.slice(visibleCount)
  const overflowHasActive = overflowModules.some((module) =>
    isSidebarModuleActive(module, pathname, searchString),
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative border-t border-white/10 bg-sand-100/95 backdrop-blur supports-[backdrop-filter]:bg-sand-100/90",
        className,
      )}
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 flex gap-1 opacity-0"
      >
        {modules.map((module) => (
          <ModuleNavMeasureItem key={`measure-${module.id}`} module={module} />
        ))}
        <button
          ref={moreMeasureRef}
          type="button"
          data-measure-item
          className={modulePillClassName(false, false, false)}
        >
          Más
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </div>

      <nav
        className="mx-auto flex h-11 max-w-[1600px] items-center px-3 sm:h-12 sm:px-4"
        aria-label="Módulos principales"
      >
        <ul className="flex min-w-0 flex-1 items-center gap-1">
          {visibleModules.map((module) => (
            <ModuleNavItem
              key={module.id}
              module={module}
              pathname={pathname}
              searchString={searchString}
              isOpen={openId === module.id}
              onHoverEnter={() => scheduleOpen(module.id)}
              onHoverLeave={scheduleClose}
              onToggle={() => toggle(module.id)}
              onNavigate={close}
            />
          ))}

          {overflowModules.length > 0 && (
            <li
              className="relative shrink-0"
              onPointerEnter={() => scheduleOpen(MORE_MENU_ID)}
              onPointerLeave={scheduleClose}
            >
              <button
                type="button"
                className={modulePillClassName(overflowHasActive, moreOpen, false)}
                onClick={() => toggle(MORE_MENU_ID)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                Más
                <ChevronDown
                  className={cn("h-3.5 w-3.5 opacity-70 transition-transform", moreOpen && "rotate-180")}
                />
              </button>

              {moreOpen && (
                <div className={cn(HOVER_MENU_PANEL_CLASS, "min-w-[220px]")}>
                  <div className="rounded-xl border border-sand-200 bg-white py-1 shadow-xl">
                    {overflowModules.map((module) => {
                      const isActive = isSidebarModuleActive(module, pathname, searchString)
                      const hasSections = Boolean(module.sections?.length)

                      if (module.href && !hasSections) {
                        return (
                          <Link
                            key={module.id}
                            href={module.href}
                            onClick={close}
                            className={cn(
                              "block px-3 py-2 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-emerald-50 text-emerald-900"
                                : "text-graphite-800 hover:bg-sand-50",
                            )}
                          >
                            {module.label}
                          </Link>
                        )
                      }

                      return (
                        <OverflowModuleSection
                          key={module.id}
                          module={module}
                          pathname={pathname}
                          searchString={searchString}
                          onNavigate={close}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </li>
          )}
        </ul>
      </nav>
    </div>
  )
}

function ModuleNavMeasureItem({ module }: { module: SidebarNavModule }) {
  const hasSections = Boolean(module.sections?.length)

  return (
    <span data-measure-item className={modulePillClassName(false, false, hasSections)}>
      {module.label}
      {hasSections && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
    </span>
  )
}

function modulePillClassName(isActive: boolean, isOpen: boolean, hasSubmenu: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
    hasSubmenu && "pr-2.5",
    isActive || isOpen
      ? "bg-emerald-800 text-white shadow-sm"
      : "text-graphite-700 hover:bg-white hover:text-pine-900",
  )
}

function ModuleNavItem({
  module,
  pathname,
  searchString,
  isOpen,
  onHoverEnter,
  onHoverLeave,
  onToggle,
  onNavigate,
}: {
  module: SidebarNavModule
  pathname: string
  searchString: string
  isOpen: boolean
  onHoverEnter: () => void
  onHoverLeave: () => void
  onToggle: () => void
  onNavigate: () => void
}) {
  const isActive = isSidebarModuleActive(module, pathname, searchString)
  const hasSections = Boolean(module.sections?.length)

  if (module.href && !hasSections) {
    return (
      <li className="relative shrink-0">
        <Link
          href={module.href}
          className={modulePillClassName(isActive, false, false)}
        >
          {module.label}
        </Link>
      </li>
    )
  }

  return (
    <li
      className="relative shrink-0"
      onPointerEnter={hasSections ? onHoverEnter : undefined}
      onPointerLeave={hasSections ? onHoverLeave : undefined}
    >
      <div className="flex items-stretch">
        {module.href ? (
          <Link
            href={module.href}
            className={cn(
              modulePillClassName(isActive, isOpen, hasSections),
              "rounded-r-none pr-2",
            )}
            onClick={onNavigate}
          >
            {module.label}
          </Link>
        ) : (
          <button
            type="button"
            className={modulePillClassName(isActive, isOpen, hasSections)}
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            {module.label}
          </button>
        )}

        {hasSections && (
          <button
            type="button"
            className={cn(
              modulePillClassName(isActive, isOpen, true),
              "rounded-l-none border-l border-white/20 px-2.5",
              !isActive && !isOpen && "border-graphite-200",
            )}
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label={`Abrir menú de ${module.label}`}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 opacity-70 transition-transform", isOpen && "rotate-180")}
            />
          </button>
        )}
      </div>

      {isOpen && hasSections && (
        <div className={HOVER_MENU_PANEL_CLASS}>
          <SidebarFlyoutPanel module={module} onNavigate={onNavigate} variant="dropdown" />
        </div>
      )}
    </li>
  )
}

function OverflowModuleSection({
  module,
  pathname,
  searchString,
  onNavigate,
}: {
  module: SidebarNavModule
  pathname: string
  searchString: string
  onNavigate: () => void
}) {
  const isActive = isSidebarModuleActive(module, pathname, searchString)

  return (
    <div className="border-t border-sand-100 first:border-t-0">
      {module.href && (
        <Link
          href={module.href}
          onClick={onNavigate}
          className={cn(
            "block px-3 py-2 text-sm font-semibold transition-colors",
            isActive ? "bg-emerald-50 text-emerald-900" : "text-pine-900 hover:bg-sand-50",
          )}
        >
          {module.label}
        </Link>
      )}

      {!module.href && (
        <p className="px-3 py-2 text-sm font-semibold text-pine-900">{module.label}</p>
      )}

      {module.sections?.map((section) => (
        <div key={section.title} className="px-2 pb-2">
          <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-graphite-400">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={`${section.title}-${item.label}`}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm transition-colors",
                    isNavLinkActive(item.href, pathname, searchString)
                      ? "bg-emerald-50 text-emerald-900"
                      : "text-graphite-700 hover:bg-sand-50",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
