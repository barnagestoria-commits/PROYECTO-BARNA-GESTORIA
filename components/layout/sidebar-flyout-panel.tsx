"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_FLYOUT_WIDTH_CLASS,
  type SidebarNavLink,
  type SidebarNavModule,
  isNavLinkActive,
} from "@/lib/navigation/sidebar-nav"

interface SidebarFlyoutPanelProps {
  module: SidebarNavModule
  onNavigate?: () => void
  className?: string
}

function FlyoutLink({
  item,
  pathname,
  searchString,
  onNavigate,
}: {
  item: SidebarNavLink
  pathname: string
  searchString: string
  onNavigate?: () => void
}) {
  const active = isNavLinkActive(item.href, pathname, searchString)

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex flex-col rounded-lg px-3 py-2.5 transition-colors",
        active
          ? "bg-emerald-50 text-emerald-900"
          : "text-graphite-800 hover:bg-sand-50 hover:text-pine-900",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {item.label}
        {item.badge && (
          <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-800">
            {item.badge}
          </span>
        )}
      </span>
      {item.description && (
        <span className="mt-0.5 text-xs leading-relaxed text-graphite-500 group-hover:text-graphite-600">
          {item.description}
        </span>
      )}
    </Link>
  )
}

export function SidebarFlyoutPanel({ module, onNavigate, className }: SidebarFlyoutPanelProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()

  if (!module.sections?.length) return null

  return (
    <div
      className={cn(
        SIDEBAR_FLYOUT_WIDTH_CLASS,
        "rounded-r-xl border border-sand-200 bg-white py-4 shadow-2xl",
        className,
      )}
    >
      <div className="border-b border-sand-100 px-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{module.label}</p>
        <p className="mt-0.5 text-sm text-graphite-500">Accesos directos</p>
      </div>

      <div className="max-h-[min(70vh,520px)] overflow-y-auto px-2 pt-3">
        {module.sections.map((section) => (
          <div key={section.title} className="mb-4 last:mb-0">
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-graphite-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <FlyoutLink
                  key={`${section.title}-${item.label}`}
                  item={item}
                  pathname={pathname}
                  searchString={searchString}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
