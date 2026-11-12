"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, Check } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { CompanyExtractPanel } from "@/components/accounting/company-extract-panel"
import { AccountMovementsDialog } from "@/components/accounting/account-movements-dialog"
import { EditAccountDialog } from "@/components/accounting/edit-account-dialog"
import { InformeDownloadCard } from "@/components/informe-download-card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import { confirmReleaseAccount } from "@/lib/accounting/release-account-client"

export function CompanyExtractPage({ initialPunteo = false }: { initialPunteo?: boolean }) {
  const { activeCompany } = useAuth()
  const currentYear = new Date().getFullYear()
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear],
  )
  const [year, setYear] = useState(currentYear)
  const [movementsOpen, setMovementsOpen] = useState(false)
  const [movementsAccount, setMovementsAccount] = useState<string | null>(null)
  const [startPunteo, setStartPunteo] = useState(false)
  const [editAccount, setEditAccount] = useState<{ cuenta: string; label: string } | null>(null)
  const [extractRefresh, setExtractRefresh] = useState(0)
  const openedPunteo = useRef(false)

  const openAccount = (accountCode: string) => {
    setStartPunteo(initialPunteo)
    setMovementsAccount(accountCode)
    setMovementsOpen(true)
  }

  const openPunteo = () => {
    setStartPunteo(true)
    setMovementsAccount(null)
    setMovementsOpen(true)
  }

  const closeMovements = () => {
    setMovementsOpen(false)
    setMovementsAccount(null)
    setStartPunteo(false)
  }

  useEffect(() => {
    if (!initialPunteo || !activeCompany || openedPunteo.current) return
    openedPunteo.current = true
    setStartPunteo(true)
    setMovementsAccount(null)
    setMovementsOpen(true)
  }, [activeCompany, initialPunteo])

  const handleReleaseAccount = async (accountCode: string, accountName: string) => {
    if (!confirmReleaseAccount(accountCode, accountName)) return
    try {
      await apiFetch("/api/accounting/accounts/release", {
        method: "POST",
        body: JSON.stringify({ accountCode }),
      })
      setExtractRefresh((value) => value + 1)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo eliminar la cuenta.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-pine-900">
            {initialPunteo ? "Punteo de extractos" : "Extracto de cuentas"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-graphite-600">
            {initialPunteo
              ? "Recorre el plan con F7 y F8. El visto marca los apuntes ya casados y «No punteados» deja a la vista lo que falta."
              : "Plan contable con debe, haber y saldo. Desde una cuenta puedes puntear y pasar a la siguiente con F8."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {activeCompany && !initialPunteo ? (
            <Button type="button" variant="outline" onClick={openPunteo}>
              <Check className="mr-1 h-4 w-4" />
              Puntear cuentas
            </Button>
          ) : null}
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
      </div>

      {!activeCompany ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No hay empresa activa. El extracto se consulta sobre tu propia contabilidad.
        </p>
      ) : (
        <CompanyExtractPanel
          year={year}
          refreshKey={extractRefresh}
          onSelectAccount={openAccount}
          onEditAccount={(accountCode, accountName) =>
            setEditAccount({ cuenta: accountCode, label: accountName })
          }
          onReleaseAccount={(accountCode, accountName) => {
            void handleReleaseAccount(accountCode, accountName)
          }}
        />
      )}

      {initialPunteo ? null : (
        <InformeDownloadCard
          title="Descargar sumas y saldos"
          description="Exporta el mismo balance a PDF o Excel."
          icon={BookOpen}
          reportType="sumas-saldos"
        />
      )}

      <AccountMovementsDialog
        open={movementsOpen}
        cuenta={movementsAccount}
        year={year}
        startPunteo={startPunteo}
        refreshKey={extractRefresh}
        onCuentaChange={setMovementsAccount}
        onBack={closeMovements}
        onClose={closeMovements}
        onEditAccount={(accountCode, accountName) =>
          setEditAccount({ cuenta: accountCode, label: accountName })
        }
        onReleaseAccount={(accountCode, accountName) => {
          void handleReleaseAccount(accountCode, accountName)
        }}
        onChanged={() => setExtractRefresh((value) => value + 1)}
      />

      <EditAccountDialog
        open={editAccount !== null}
        accountCode={editAccount?.cuenta ?? null}
        accountName={editAccount?.label}
        onClose={() => setEditAccount(null)}
        onSaved={(account) => {
          setExtractRefresh((value) => value + 1)
          if (movementsAccount && movementsAccount.replace(/\D/g, "") === account.fromAccountCode) {
            setMovementsAccount(account.formattedAccountCode)
          }
        }}
      />
    </div>
  )
}
