"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, Settings, Sparkles, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarUserMenuProps {
  userName: string
  onLogout: () => void
  variant?: "desktop" | "mobile"
  /** top = debajo del logo; footer = pie del sidebar (legacy) */
  placement?: "top" | "footer"
  onNavigate?: () => void
}

const USER_LINKS = [
  {
    href: "/configuracion",
    label: "Configuración de la Cuenta / Perfil",
    icon: Settings,
    match: (path: string) =>
      path === "/configuracion" || path === "/dashboard/configuracion",
  },
  {
    href: "/configuracion#suscripcion",
    label: "Suscripción y plan",
    icon: Sparkles,
    match: (path: string) => false,
  },
  {
    href: "/configuracion/certificado",
    label: "Certificado Digital & Verifactu",
    icon: KeyRound,
    match: (path: string) => path.startsWith("/configuracion/certificado"),
  },
] as const

export function SidebarUserMenu({
  userName,
  onLogout,
  variant = "desktop",
  placement = "footer",
  onNavigate,
}: SidebarUserMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const isActive = USER_LINKS.some((link) => link.match(pathname))

  if (variant === "mobile") {
    return (
      <MobileUserSection
        userName={userName}
        pathname={pathname}
        onNavigate={onNavigate}
        onLogout={onLogout}
        placement={placement}
      />
    )
  }

  const opensUpward = placement === "footer"

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
          placement === "top"
            ? "border border-white/10 bg-white/5 text-white hover:border-emerald-500/30 hover:bg-white/10"
            : open || isActive
              ? "bg-white/10 text-white"
              : "text-white/80 hover:bg-white/5 hover:text-white",
          (open || isActive) && placement === "top" && "border-emerald-500/40 bg-white/10",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de cuenta y configuración"
      >
        <User className="h-4 w-4 shrink-0 text-emerald-300/80" />
        <span className="min-w-0 flex-1 truncate font-medium">{userName}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-[110] w-full min-w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#1c221f] py-1 shadow-2xl",
            opensUpward ? "bottom-full mb-2" : "top-full mt-2",
          )}
          role="menu"
        >
          {USER_LINKS.map((link) => {
            const Icon = link.icon
            const active = link.match(pathname)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-emerald-800/40 text-white"
                    : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            )
          })}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-200 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

function MobileUserSection({
  userName,
  pathname,
  onNavigate,
  onLogout,
  placement = "footer",
}: {
  userName: string
  pathname: string
  onNavigate?: () => void
  onLogout: () => void
  placement?: "top" | "footer"
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg",
        placement === "top" ? "border border-white/10 bg-white/5" : "border border-white/5",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-white/90"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label="Menú de cuenta y configuración"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-emerald-300/80" />
          <span className="truncate font-medium">{userName}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/50 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t border-white/5 bg-white/[0.03] py-1">
          {USER_LINKS.map((link) => {
            const Icon = link.icon
            const active = link.match(pathname)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm",
                  active ? "bg-emerald-800/40 text-white" : "text-white/70 hover:bg-white/5",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => {
              onNavigate?.()
              onLogout()
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-200 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
