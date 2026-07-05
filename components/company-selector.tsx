"use client"

import { Building2, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"

export function CompanySelector() {
  const { session, activeCompany, setActiveCompany } = useAuth()

  if (!session || !activeCompany) return null

  if (session.canSwitchCompanies && session.companies.length > 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="hidden h-4 w-4 text-emerald-700 sm:block" />
        <select
          value={session.activeCompanyId ?? ""}
          onChange={(e) => setActiveCompany(e.target.value)}
          className="h-9 max-w-[220px] rounded-md border border-input bg-background px-2 text-sm md:max-w-xs"
          aria-label="Seleccionar empresa cliente"
        >
          {session.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <Badge variant="secondary" className="hidden md:inline-flex">
          {session.companies.length} clientes
        </Badge>
      </div>
    )
  }

  if (session.canSwitchCompanies && session.companies.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Building2 className="h-4 w-4 text-emerald-700" />
        <span className="font-medium">{activeCompany.name}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
      <Lock className="h-4 w-4 text-emerald-700" />
      <span className="font-medium text-emerald-900">{activeCompany.name}</span>
      {activeCompany.cif && (
        <span className="hidden text-emerald-700 sm:inline">• {activeCompany.cif}</span>
      )}
    </div>
  )
}
