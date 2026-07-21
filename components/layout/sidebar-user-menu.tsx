"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarUserMenuProps {
  userName: string
  onLogout: () => void
  variant?: "desktop" | "mobile"
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
      />
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          open || isActive
            ? "bg-white/10 text-white"
            : "text-white/80 hover:bg-white/5 hover:text-white",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <User className="h-4 w-4 shrink-0 text-emerald-300/80" />
        <span className="min-w-0 flex-1 truncate">{userName}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[260px] overflow-hidden rounded-xl border border-white/10 bg-[#1c221f] py-1 shadow-2xl">
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
}: {
  userName: string
  pathname: string
  onNavigate?: () => void
  onLogout: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-white/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-white/80"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-3">
          <User className="h-4 w-4 text-emerald-300/80" />
          {userName}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
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
