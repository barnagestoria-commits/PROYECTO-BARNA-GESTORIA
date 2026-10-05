"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { MobileNavSheet } from "@/components/layout/mobile-nav-sheet"
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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const apply = () => setMatches(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [query])

  return matches
}

interface ModuleNavBarProps {
  modules: SidebarNavModule[]
  className?: string
}

export function ModuleNavBar({ modules, className }: ModuleNavBarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const { openId, scheduleOpen, scheduleClose, toggle, close } = useHoverMenu()
  const isCompactNav = useMediaQuery("(max-width: 767px)")
  const prefersFineHover = useMediaQuery("(hover: hover) and (pointer: fine)")
  const useHoverMenus = prefersFineHover && !isCompactNav

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
    if (isCompactNav) return

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [close, isCompactNav])

  const visibleModules = modules.slice(0, visibleCount)
  const overflowModules = modules.slice(visibleCount)
  const overflowHasActive = overflowModules.some((module) =>
    isSidebarModuleActive(module, pathname, searchString),
  )
  const showMore = isCompactNav || overflowModules.length > 0

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-x-hidden border-t border-white/10 bg-sand-100/95 backdrop-blur supports-[backdrop-filter]:bg-sand-100/90",
        className,
      )}
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 h-0 w-0 overflow-hidden opacity-0"
      >
        <div className="flex w-max gap-1">
          {modules.map((module) => (
            <ModuleNavMeasureItem key={`measure-${module.id}`} module={module} compact={isCompactNav} />
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
      </div>

      <nav
        className="mx-auto flex h-11 w-full min-w-0 max-w-[1600px] items-center overflow-hidden px-4 md:h-12"
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
              compact={isCompactNav}
              enableHover={useHoverMenus}
              onHoverEnter={() => scheduleOpen(module.id)}
              onHoverLeave={scheduleClose}
              onToggle={() => (isCompactNav ? toggle(MORE_MENU_ID) : toggle(module.id))}
              onNavigate={close}
            />
          ))}

          {showMore && (
            <li
              className="relative ml-auto shrink-0"
              onPointerEnter={useHoverMenus ? () => scheduleOpen(MORE_MENU_ID) : undefined}
              onPointerLeave={useHoverMenus ? scheduleClose : undefined}
            >
              <button
                type="button"
                className={modulePillClassName(overflowHasActive, moreOpen, false)}
                onClick={() => toggle(MORE_MENU_ID)}
                aria-expanded={moreOpen}
                aria-haspopup={isCompactNav ? "dialog" : "menu"}
              >
                Más
                <ChevronDown
                  className={cn("h-3.5 w-3.5 opacity-70 transition-transform", moreOpen && "rotate-180")}
                />
              </button>

              {moreOpen && !isCompactNav && overflowModules.length > 0 && (
                <div className={cn(HOVER_MENU_PANEL_CLASS, "right-0 left-auto w-[min(18rem,calc(100vw-1.25rem))]")}>
                  <div className="max-h-[min(70vh,calc(100dvh-8rem))] overflow-y-auto rounded-xl border border-sand-200 bg-white py-1 shadow-xl">
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

      <MobileNavSheet open={isCompactNav && moreOpen} onClose={close} modules={modules} />
    </div>
  )
}

function ModuleNavMeasureItem({
  module,
  compact,
}: {
  module: SidebarNavModule
  compact: boolean
}) {
  const hasSections = Boolean(module.sections?.length) && !compact

  return (
    <span data-measure-item className={modulePillClassName(false, false, hasSections)}>
      {module.label}
      {hasSections && <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
    </span>
  )
}

function modulePillClassName(isActive: boolean, isOpen: boolean, hasSubmenu: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
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
  compact,
  enableHover,
  onHoverEnter,
  onHoverLeave,
  onToggle,
  onNavigate,
}: {
  module: SidebarNavModule
  pathname: string
  searchString: string
  isOpen: boolean
  compact: boolean
  enableHover: boolean
  onHoverEnter: () => void
  onHoverLeave: () => void
  onToggle: () => void
  onNavigate: () => void
}) {
  const isActive = isSidebarModuleActive(module, pathname, searchString)
  const hasSections = Boolean(module.sections?.length)
  const showChevron = hasSections && !compact

  if ((module.href && !hasSections) || (compact && module.href)) {
    return (
      <li className="relative shrink-0">
        <Link href={module.href!} className={modulePillClassName(isActive, false, false)}>
          {module.label}
        </Link>
      </li>
    )
  }

  return (
    <li
      className="relative shrink-0"
      onPointerEnter={enableHover && hasSections ? onHoverEnter : undefined}
      onPointerLeave={enableHover && hasSections ? onHoverLeave : undefined}
    >
      <div className="flex items-stretch">
        {module.href ? (
          <Link
            href={module.href}
            className={cn(
              modulePillClassName(isActive, isOpen, showChevron),
              showChevron && "rounded-r-none pr-2",
            )}
            onClick={onNavigate}
          >
            {module.label}
          </Link>
        ) : (
          <button
            type="button"
            className={modulePillClassName(isActive, isOpen, showChevron)}
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            {module.label}
          </button>
        )}

        {showChevron && (
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

      {isOpen && hasSections && !compact && (
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
