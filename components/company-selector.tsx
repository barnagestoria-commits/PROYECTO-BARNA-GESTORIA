"use client"

import { Building2, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"

export function CompanySelector() {
  const { session, activeCompany, setActiveCompany } = useAuth()

  if (!session || !activeCompany) return null

  if (session.canSwitchCompanies && session.companies.length > 1) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="hidden h-4 w-4 shrink-0 text-emerald-700 sm:block" />
          <select
            value={session.activeCompanyId ?? ""}
            onChange={(e) => setActiveCompany(e.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm sm:max-w-xs md:max-w-sm"
            aria-label="Seleccionar empresa cliente"
          >
            {session.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <Badge variant="secondary" className="w-fit">
          {session.companies.length} clientes
        </Badge>
      </div>
    )
  }

  if (session.canSwitchCompanies && session.companies.length === 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
        <Building2 className="h-4 w-4 shrink-0 text-emerald-700" />
        <span className="break-words font-medium">{activeCompany.name}</span>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm sm:items-center">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 sm:mt-0" />
      <span className="min-w-0 break-words font-medium text-emerald-900">{activeCompany.name}</span>
      {activeCompany.cif && (
        <span className="shrink-0 text-emerald-700 sm:ml-1">• {activeCompany.cif}</span>
      )}
    </div>
  )
}
