"use client"

import { Building2, ChevronDown } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

interface SidebarCompanySelectorProps {
  className?: string
  /** Oculta la ficha estática si coincide con el nombre de usuario (evita duplicado con el menú de perfil). */
  userName?: string
}

export function SidebarCompanySelector({ className, userName }: SidebarCompanySelectorProps) {
  const { session, activeCompany, setActiveCompany } = useAuth()

  if (!session || !activeCompany) {
    return (
      <div className={cn("rounded-lg border border-white/10 bg-white/5 px-3 py-2", className)}>
        <p className="text-xs text-white/50">Sin empresa activa</p>
      </div>
    )
  }

  if (session.canSwitchCompanies && session.companies.length > 1) {
    return (
      <div className={cn("relative", className)}>
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300/80" />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <select
          value={session.activeCompanyId ?? ""}
          onChange={(e) => setActiveCompany(e.target.value)}
          className="h-10 w-full appearance-none truncate rounded-lg border border-white/10 bg-white/5 pl-9 pr-8 text-sm font-medium text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          aria-label="Seleccionar empresa o cliente activo"
        >
          {session.companies.map((company) => (
            <option key={company.id} value={company.id} className="bg-pine-900 text-white">
              {company.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (!session.canSwitchCompanies && userName && activeCompany.name === userName) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5",
        className,
      )}
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{activeCompany.name}</p>
        {activeCompany.cif && (
          <p className="truncate text-xs text-white/50">{activeCompany.cif}</p>
        )}
      </div>
    </div>
  )
}
