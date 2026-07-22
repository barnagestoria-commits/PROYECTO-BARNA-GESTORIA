"use client"

import { Plus, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  createEmptyVatLine,
  recalculateVatQuota,
  sumInvoiceTotals,
  type InvoiceEntryDetails,
} from "@/lib/types/invoice-entry-details"
import { formatEuro } from "@/lib/accounting/command-templates"

interface InvoiceEntryPanelProps {
  invoiceMode: "emitida" | "recibida"
  isManual?: boolean
  details: InvoiceEntryDetails
  onChange: (details: InvoiceEntryDetails) => void
  onApplyTotals: (totals: { base: number; quota: number; total: number }) => void
  onOpenNifLookup: () => void
}

export function InvoiceEntryPanel({
  invoiceMode,
  isManual = false,
  details,
  onChange,
  onApplyTotals,
  onOpenNifLookup,
}: InvoiceEntryPanelProps) {
  const totals = sumInvoiceTotals(details.vatLines)
  const isReceived = invoiceMode === "recibida"

  const updateVatLine = (
    lineId: string,
    patch: Partial<(typeof details.vatLines)[number]>,
  ) => {
    const vatLines = details.vatLines.map((line) => {
      if (line.id !== lineId) return line
      return recalculateVatQuota({ ...line, ...patch })
    })
    onChange({ ...details, vatLines })
  }

  const addVatLine = () => {
    onChange({
      ...details,
      vatLines: [...details.vatLines, createEmptyVatLine()],
    })
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-800">
            <Receipt className="h-4 w-4" />
            Datos de factura
          </div>
          <p className="text-sm text-graphite-600">
            {isManual
              ? "Asiento manual con datos de factura"
              : isReceived
                ? "Factura recibida · proveedor"
                : "Factura emitida · cliente"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={details.isRectificativa ? "default" : "secondary"}>
            {details.isRectificativa ? "Rectificativa" : "Ordinaria"}
          </Badge>
          <Button type="button" size="sm" variant="outline" onClick={onOpenNifLookup}>
            F6 · Buscar NIF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="invoice-number">Nro. factura</Label>
          <Input
            id="invoice-number"
            value={details.invoiceNumber}
            onChange={(event) => onChange({ ...details, invoiceNumber: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issue-date">F. expedición</Label>
          <Input
            id="issue-date"
            type="date"
            value={details.issueDate}
            onChange={(event) => onChange({ ...details, issueDate: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="operation-date">F. operación</Label>
          <Input
            id="operation-date"
            type="date"
            value={details.operationDate}
            onChange={(event) => onChange({ ...details, operationDate: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-nif">N.I.F.</Label>
          <Input
            id="invoice-nif"
            value={details.nif}
            onChange={(event) => onChange({ ...details, nif: event.target.value.toUpperCase() })}
            className="font-mono uppercase"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="third-party-name">
            {isReceived ? "Proveedor registro" : "Cliente"}
          </Label>
          <Input
            id="third-party-name"
            value={details.thirdPartyName}
            onChange={(event) => onChange({ ...details, thirdPartyName: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 self-end rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={details.isRectificativa}
            onChange={(event) => onChange({ ...details, isRectificativa: event.target.checked })}
          />
          Rectificativa
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-sand-200 bg-white">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
            <tr>
              <th className="px-3 py-2">Op.</th>
              <th className="px-3 py-2">Base</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2">Cuota</th>
            </tr>
          </thead>
          <tbody>
            {details.vatLines.map((line) => (
              <tr key={line.id} className="border-t border-sand-100">
                <td className="px-2 py-1">
                  <Input
                    value={line.operation}
                    onChange={(event) => updateVatLine(line.id, { operation: event.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.base || ""}
                    onChange={(event) =>
                      updateVatLine(line.id, { base: Number.parseFloat(event.target.value) || 0 })
                    }
                    className="h-8 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    value={line.vatType}
                    onChange={(event) => updateVatLine(line.id, { vatType: event.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.vatPercent || ""}
                    onChange={(event) =>
                      updateVatLine(line.id, {
                        vatPercent: Number.parseFloat(event.target.value) || 0,
                      })
                    }
                    className="h-8 text-right font-mono"
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatEuro(line.quota)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-graphite-700">
          <span>Base: <strong>{formatEuro(totals.base)}</strong></span>
          <span>IVA: <strong>{formatEuro(totals.quota)}</strong></span>
          <span>Total: <strong>{formatEuro(totals.total)}</strong></span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addVatLine}>
            <Plus className="mr-1 h-4 w-4" />
            Ampliar factura
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-800 hover:bg-pine-900"
            onClick={() => onApplyTotals(totals)}
          >
            Aplicar al asiento
          </Button>
        </div>
      </div>
    </div>
  )
}
