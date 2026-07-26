"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchChartAccounts } from "@/lib/accounting/pgc-accounts"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { cn } from "@/lib/utils"

interface PgcChartDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (accountCode: string, accountName: string) => void
  ledgerSubaccounts?: LedgerSubaccountOption[]
}

export function PgcChartDialog({
  open,
  onClose,
  onSelect,
  ledgerSubaccounts = [],
}: PgcChartDialogProps) {
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (open) {
      setQuery("")
    }
  }, [open])

  const accounts = useMemo(
    () =>
      searchChartAccounts(query, {
        ledgerSubaccounts,
        limit: 100,
      }),
    [ledgerSubaccounts, query],
  )

  const showEmptyState = query.trim().length > 0 && accounts.length === 0

  return (
    <AccountingModal
      open={open}
      title="Plan General Contable"
      subtitle="F4 · Selecciona una cuenta para la línea activa"
      onClose={onClose}
      footer={
        <p className="text-xs text-graphite-500">
          Busca por código (430) o por nombre (clientes, IVA, bancos…). Pulsa Enter o haz clic para
          asignar la cuenta.
        </p>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código o descripción..."
            className="h-10 pl-10"
            autoFocus
          />
        </div>

        <div className="max-h-[420px] overflow-auto rounded-lg border border-sand-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
              <tr>
                <th className="w-28 px-3 py-2">Cuenta</th>
                <th className="px-3 py-2">Descripción PGC</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={`${account.source}-${account.accountCode}`}
                  className="cursor-pointer border-t border-sand-100 hover:bg-emerald-50"
                  onClick={() => {
                    onSelect(account.accountCode, account.name)
                    onClose()
                  }}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-pine-900">{account.code}</td>
                  <td className="px-3 py-2 text-graphite-700">
                    {account.name}
                    {account.source === "ledger" && (
                      <span className="ml-2 text-xs text-graphite-400">Subcuenta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showEmptyState && (
            <p className="px-4 py-8 text-center text-sm text-graphite-500">
              No hay cuentas que coincidan con la búsqueda.
            </p>
          )}
          {!query.trim() && accounts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-graphite-500">
              No hay cuentas disponibles.
            </p>
          )}
        </div>
      </div>
    </AccountingModal>
  )
}

export function PgcChartInlineHint({ className }: { className?: string }) {
  return (
    <span className={cn("text-xs text-graphite-500", className)}>
      F4 · Plan contable
    </span>
  )
}
