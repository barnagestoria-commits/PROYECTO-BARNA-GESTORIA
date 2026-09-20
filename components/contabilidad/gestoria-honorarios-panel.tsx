"use client"

import { useEffect, useState } from "react"
import { Receipt } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import type { GestoriaHonorariosInvoice } from "@/lib/gestoria/team-types"

export function GestoriaHonorariosPanel({ companyId }: { companyId: string }) {
  const [invoices, setInvoices] = useState<GestoriaHonorariosInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    void apiFetch<{ success: true; invoices: GestoriaHonorariosInvoice[] }>(
      `/api/gestoria/honorarios?companyId=${encodeURIComponent(companyId)}`,
    )
      .then((data) => {
        if (!cancelled) setInvoices(data.invoices)
      })
      .catch(() => {
        if (!cancelled) setInvoices([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId])

  const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })

  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-pine-900">
        <Receipt className="h-4 w-4 text-emerald-700" />
        Facturas de honorarios de la gestoría
      </div>
      <p className="mb-3 text-xs text-graphite-500">
        Solo lectura. Sirven para contabilizarlas en este expediente. No incluyen balances ni impuestos
        de la gestoría.
      </p>
      {isLoading ? (
        <p className="text-sm text-graphite-500">Cargando honorarios…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-graphite-500">No hay facturas emitidas de la gestoría a este cliente.</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
            >
              <span className="text-graphite-600">{invoice.fecha}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-pine-900">
                {invoice.invoiceNumber || invoice.concepto}
              </span>
              <span className="font-semibold text-pine-900">{euro.format(invoice.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
