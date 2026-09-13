"use client"

import { useMemo, useState } from "react"
import { BookOpen } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { CompanyExtractPanel } from "@/components/accounting/company-extract-panel"
import { AccountMovementsDialog } from "@/components/accounting/account-movements-dialog"
import { InformeDownloadCard } from "@/components/informe-download-card"
import { Label } from "@/components/ui/label"

export function CompanyExtractPage() {
  const { activeCompany } = useAuth()
  const currentYear = new Date().getFullYear()
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear],
  )
  const [year, setYear] = useState(currentYear)
  const [movementsAccount, setMovementsAccount] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-pine-900">Extracto de cuentas</h1>
          <p className="mt-1 text-sm text-graphite-600">
            Plan contable configurado con debe, haber y saldo. También las cuentas a cero.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extract-year">Ejercicio</Label>
          <select
            id="extract-year"
            value={year}
            onChange={(event) => setYear(Number.parseInt(event.target.value, 10))}
            className="flex h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!activeCompany ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay empresa activa. El extracto se consulta sobre tu propia contabilidad.
        </p>
      ) : (
        <CompanyExtractPanel
          year={year}
          onSelectAccount={(accountCode) => setMovementsAccount(accountCode)}
        />
      )}

      <InformeDownloadCard
        title="Descargar sumas y saldos"
        description="Exporta el mismo balance a PDF o Excel."
        icon={BookOpen}
        reportType="sumas-saldos"
      />

      <AccountMovementsDialog
        open={movementsAccount !== null}
        cuenta={movementsAccount}
        year={year}
        onClose={() => setMovementsAccount(null)}
      />
    </div>
  )
}
