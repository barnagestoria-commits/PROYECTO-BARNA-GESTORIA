"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { InvoiceEntryPanel } from "@/components/accounting/invoice-entry-panel"
import { apiFetch } from "@/lib/api-client"
import {
  calculateTotals,
  createEmptyLine,
  formatEuro,
  validateEntryLines,
} from "@/lib/accounting/command-templates"
import type { AccountingEntryDetail } from "@/lib/accounting/entry-payload"
import { getEditableInvoiceDetails, hasInvoiceData } from "@/lib/accounting/entry-service"
import type { AccountingEntryLine } from "@/lib/types/accounting-entry"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"
import {
  isEmitidaThirdPartyAccount,
} from "@/lib/accounting/account-suggestions"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import {
  applyInvoiceConceptsToLines,
  INVOICE_CONCEPT_PREFIX,
  isInvoiceConceptAccountLine,
  isInvoiceConceptCommand,
} from "@/lib/accounting/invoice-entry-concepts"
import { cn } from "@/lib/utils"

interface EditAccountingEntryDialogProps {
  open: boolean
  entryId: string | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function mapEntryLines(entry: AccountingEntryDetail): AccountingEntryLine[] {
  return entry.lines.map((line) => ({
    id: line.id,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: line.debe,
    haber: line.haber,
  }))
}

export function EditAccountingEntryDialog({
  open,
  entryId,
  onClose,
  onSaved,
  onDeleted,
}: EditAccountingEntryDialogProps) {
  const [entry, setEntry] = useState<AccountingEntryDetail | null>(null)
  const [fecha, setFecha] = useState("")
  const [lines, setLines] = useState<AccountingEntryLine[]>([])
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceEntryDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const totals = useMemo(() => calculateTotals(lines), [lines])
  const lineValidations = useMemo(() => validateEntryLines(lines), [lines])

  const invoiceMode = useMemo((): "emitida" | "recibida" => {
    if (entry?.commandCode === "34") return "recibida"
    if (entry?.commandCode === "17") return "emitida"
    if (lines.some((line) => isEmitidaThirdPartyAccount(line.cuenta))) return "emitida"
    return "recibida"
  }, [entry?.commandCode, lines])

  const showInvoicePanel = useMemo(() => {
    if (!entry) return false
    return hasInvoiceData(entry) || lines.some((line) => isThirdPartyAccountPrefix(line.cuenta))
  }, [entry, lines])

  useEffect(() => {
    if (!open || !entryId) {
      setEntry(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    apiFetch<{ success: true; entry: AccountingEntryDetail }>(`/api/accounting/entries/${entryId}`)
      .then((data) => {
        if (cancelled) return
        setEntry(data.entry)
        setFecha(data.entry.fecha)
        setLines(mapEntryLines(data.entry))
        setInvoiceDetails(getEditableInvoiceDetails(data.entry))
      })
      .catch((err) => {
        if (!cancelled) {
          setEntry(null)
          setError(err instanceof Error ? err.message : "No se pudo cargar el asiento.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [entryId, open])

  const updateLine = (lineId: string, patch: Partial<AccountingEntryLine>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)))
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
  }

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev))
  }

  const applyInvoiceTotals = useCallback(
    (amounts: { base: number; quota: number; total: number }) => {
      setLines((prev) => {
        const thirdIdx = prev.findIndex((line) => isThirdPartyAccountPrefix(line.cuenta))
        const vatIdx = prev.findIndex((line) => /^47[27]/.test(line.cuenta.replace(/\D/g, "")))
        const baseIdx = prev.findIndex((line) => /^[67]/.test(line.cuenta.replace(/\D/g, "")))

        const thirdPartyIndex = thirdIdx >= 0 ? thirdIdx : 0
        const vatIndex = vatIdx >= 0 ? vatIdx : 1
        const baseIndex = baseIdx >= 0 ? baseIdx : 2
        const emitida =
          entry?.commandCode === "17" ||
          (entry?.commandCode !== "34" && isEmitidaThirdPartyAccount(prev[thirdPartyIndex]?.cuenta ?? ""))

        const next = prev.map((line, index) => {
          if (emitida) {
            if (index === thirdPartyIndex) return { ...line, debe: amounts.total, haber: 0 }
            if (index === vatIndex) return { ...line, debe: 0, haber: amounts.quota }
            if (index === baseIndex) return { ...line, debe: 0, haber: amounts.base }
          } else {
            if (index === thirdPartyIndex) return { ...line, debe: 0, haber: amounts.total }
            if (index === vatIndex) return { ...line, debe: amounts.quota, haber: 0 }
            if (index === baseIndex) return { ...line, debe: amounts.base, haber: 0 }
          }
          return line
        })

        return entry?.commandCode && isInvoiceConceptCommand(entry.commandCode)
          ? applyInvoiceConceptsToLines(next, entry.commandCode, invoiceDetails?.invoiceNumber ?? "")
          : next
      })
    },
    [entry?.commandCode, invoiceDetails?.invoiceNumber],
  )

  useEffect(() => {
    if (!entry?.commandCode || !isInvoiceConceptCommand(entry.commandCode)) return
    setLines((prev) =>
      applyInvoiceConceptsToLines(
        prev,
        entry.commandCode as "17" | "34",
        invoiceDetails?.invoiceNumber ?? "",
      ),
    )
  }, [entry?.commandCode, invoiceDetails?.invoiceNumber])

  const handleDelete = async () => {
    if (!entryId || !entry || isDeleting) return

    const confirmed = window.confirm(
      "¿Eliminar este asiento de forma permanente? Esta acción no se puede deshacer.",
    )
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiFetch(`/api/accounting/entries/${entryId}`, { method: "DELETE" })
      onDeleted?.()
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el asiento.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!entryId || !entry || !totals.isBalanced || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      await apiFetch(`/api/accounting/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fecha,
          issueDate: invoiceDetails?.issueDate ?? entry.issueDate,
          operationDate: invoiceDetails?.operationDate ?? entry.operationDate,
          invoiceNumber: invoiceDetails?.invoiceNumber ?? entry.invoiceNumber,
          invoiceDetails: showInvoicePanel ? invoiceDetails : null,
          commandCode: entry.commandCode,
          lines: lines.map(({ cuenta, concepto, debe, haber }) => ({
            cuenta,
            concepto,
            debe,
            haber,
          })),
        }),
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el asiento.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AccountingModal
      open={open}
      title="Modificación de apunte"
      subtitle={entry ? `Asiento ${entry.id.slice(0, 8)} · ${entry.commandCode ?? "Manual"}` : undefined}
      onClose={onClose}
      className="max-w-6xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-graphite-600">
            {totals.isBalanced ? (
              <span className="text-emerald-800">Asiento cuadrado · {formatEuro(totals.debe)}</span>
            ) : (
              <span className="text-red-700">
                Descuadrado: {formatEuro(Math.abs(totals.difference))}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={isLoading || isDeleting || isSaving}
              onClick={handleDelete}
              title="Eliminar asiento"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="mr-1 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={!totals.isBalanced || isSaving || isLoading}
              onClick={handleSave}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-emerald-800">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando asiento…
        </div>
      ) : error && !entry ? (
        <p className="py-8 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : entry ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-entry-fecha">Fecha asiento</Label>
              <Input
                id="edit-entry-fecha"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </div>
            {showInvoicePanel && invoiceDetails && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-issue-date">F. expedición</Label>
                  <Input
                    id="edit-issue-date"
                    type="date"
                    value={invoiceDetails.issueDate}
                    onChange={(event) =>
                      setInvoiceDetails({ ...invoiceDetails, issueDate: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-operation-date">F. operación</Label>
                  <Input
                    id="edit-operation-date"
                    type="date"
                    value={invoiceDetails.operationDate}
                    onChange={(event) =>
                      setInvoiceDetails({ ...invoiceDetails, operationDate: event.target.value })
                    }
                  />
                </div>
              </>
            )}
          </div>

          {showInvoicePanel && invoiceDetails && (
            <InvoiceEntryPanel
              invoiceMode={invoiceMode}
              isManual={!entry.commandCode || (entry.commandCode !== "17" && entry.commandCode !== "34")}
              invoiceConceptPrefix={
                entry.commandCode === "17"
                  ? INVOICE_CONCEPT_PREFIX["17"]
                  : entry.commandCode === "34"
                    ? INVOICE_CONCEPT_PREFIX["34"]
                    : null
              }
              details={invoiceDetails}
              onChange={setInvoiceDetails}
              onApplyTotals={applyInvoiceTotals}
              onOpenPgcChart={() => undefined}
              onOpenNifLookup={() => undefined}
            />
          )}

          <div className="overflow-x-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                <tr>
                  <th className="px-3 py-2">Cuenta</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2 text-right">Debe</th>
                  <th className="px-3 py-2 text-right">Haber</th>
                  <th className="px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const invoiceConceptLocked =
                    entry.commandCode !== null &&
                    isInvoiceConceptCommand(entry.commandCode) &&
                    isInvoiceConceptAccountLine(line.cuenta, entry.commandCode)

                  return (
                  <tr key={line.id} className="border-t border-sand-100">
                    <td className="px-2 py-1">
                      <Input
                        value={line.cuenta}
                        onChange={(event) => updateLine(line.id, { cuenta: event.target.value })}
                        className="h-9 font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={line.concepto}
                        onChange={(event) => updateLine(line.id, { concepto: event.target.value })}
                        readOnly={invoiceConceptLocked}
                        tabIndex={invoiceConceptLocked ? -1 : undefined}
                        className={cn(
                          "h-9",
                          invoiceConceptLocked && "bg-sand-50 text-graphite-600",
                        )}
                        title={
                          invoiceConceptLocked
                            ? "Edita el número de factura en Datos de factura"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debe || ""}
                        onChange={(event) =>
                          updateLine(line.id, { debe: Number.parseFloat(event.target.value) || 0 })
                        }
                        className="h-9 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.haber || ""}
                        onChange={(event) =>
                          updateLine(line.id, { haber: Number.parseFloat(event.target.value) || 0 })
                        }
                        className="h-9 text-right font-mono"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-4 w-4" />
            Añadir línea
          </Button>

          {lineValidations.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {lineValidations.map((validation, index) => (
                <p key={`${validation.lineId}-${index}`}>{validation.message}</p>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </AccountingModal>
  )
}
