"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Globe,
  Loader2,
  Plus,
  ScanLine,
  Scale,
  Trash2,
  X,
} from "lucide-react"
import type { InvoiceOcrResult, IvaDesgloseLine, TipoIva } from "@/lib/types/invoice"
import type { ThirdPartyResolution } from "@/lib/accounting/third-party-types"
import { apiFetch } from "@/lib/api-client"
import { normalizeTaxId } from "@/lib/tax-id"
import { TIPOS_IVA } from "@/lib/types/invoice"
import { InvoiceDocumentPreview } from "@/components/invoice-document-preview"
import {
  classifyReceivedInvoicePurchase,
  PURCHASE_EXPENSE_OPTIONS,
  type ReceivedAccountPrefix,
} from "@/lib/accounting/invoice-supplier-classification"
import {
  calculateCuotaIva,
  calculateTotalFromBreakdown,
  createEmptyDesgloseLine,
  round2,
  sumDesglose,
  syncInvoiceTotals,
} from "@/lib/invoice-totals"

interface InvoiceValidationFormProps {
  fileName: string
  file?: File | null
  initialData: InvoiceOcrResult
  documentType?: "factura-recibida" | "factura-emitida"
  progressLabel?: string
  remainingCount?: number
  onConfirm: (data: InvoiceOcrResult) => void
  onCancel: () => void
  onSkip?: () => void
  isSubmitting?: boolean
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function looksLikeCompleteAccountCode(value: string): boolean {
  const trimmed = value.trim()
  if (/^\d{2,4}\.\d+$/.test(trimmed)) return true
  return trimmed.replace(/\D/g, "").length >= 6
}

export function InvoiceValidationForm({
  fileName,
  file = null,
  initialData,
  documentType = "factura-recibida",
  progressLabel,
  remainingCount = 0,
  onConfirm,
  onCancel,
  onSkip,
  isSubmitting = false,
}: InvoiceValidationFormProps) {
  const [formData, setFormData] = useState<InvoiceOcrResult>(() => {
    const seeded = syncInvoiceTotals({
      ...initialData,
      cif: normalizeTaxId(initialData.cif),
    })
    if (documentType === "factura-emitida") {
      return { ...seeded, accountPrefix: "430" }
    }
    const classified = classifyReceivedInvoicePurchase({
      proveedor: seeded.proveedor,
      numeroFactura: seeded.numeroFactura,
      fileName,
      naturalezaCompra: seeded.naturalezaCompra,
    })
    return {
      ...seeded,
      accountPrefix: seeded.accountPrefix ?? classified.accountPrefix,
      expenseAccount: seeded.expenseAccount ?? classified.expenseAccount,
      classificationReason: seeded.classificationReason ?? classified.reason,
    }
  })
  const [ocrTotal] = useState(initialData.total)
  const [accountPreview, setAccountPreview] = useState<ThirdPartyResolution | null>(null)
  const [accountPreviewError, setAccountPreviewError] = useState<string | null>(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(false)
  const [userOverrodeAccounts, setUserOverrodeAccounts] = useState(false)
  const [accountCodeDraft, setAccountCodeDraft] = useState(initialData.preferredAccountCode ?? "")
  const [userEditedAccountCode, setUserEditedAccountCode] = useState(Boolean(initialData.preferredAccountCode))

  const thirdPartyType = documentType === "factura-emitida" ? "CLIENTE" : "PROVEEDOR"
  const thirdPartyLabel = documentType === "factura-emitida" ? "Cliente" : "Proveedor"
  const selectedPrefix: ReceivedAccountPrefix | "430" =
    documentType === "factura-emitida"
      ? "430"
      : formData.accountPrefix === "400" || formData.accountPrefix === "410"
        ? formData.accountPrefix
        : "410"
  const accountGroupLabel = selectedPrefix

  const { baseImponible, iva } = useMemo(
    () => sumDesglose(formData.iva_desglose),
    [formData.iva_desglose],
  )

  const calculatedTotal = useMemo(
    () => calculateTotalFromBreakdown(formData.iva_desglose, formData.recargo_equivalencia),
    [formData.iva_desglose, formData.recargo_equivalencia],
  )

  const totalsMatch = Math.abs(calculatedTotal - ocrTotal) < 0.02

  useEffect(() => {
    const cif = formData.cif.trim()
    if (!cif) {
      setAccountPreview(null)
      setAccountPreviewError(null)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoadingAccount(true)
      setAccountPreviewError(null)

      try {
        const params = new URLSearchParams({
          cif,
          name: formData.proveedor.trim(),
          type: thirdPartyType,
          prefix: selectedPrefix,
          reuseExisting: "1",
        })
        if (userEditedAccountCode && looksLikeCompleteAccountCode(accountCodeDraft)) {
          params.set("accountCode", accountCodeDraft.trim())
        }
        const result = await apiFetch<{ success: true; resolution: ThirdPartyResolution }>(
          `/api/accounting/third-parties/resolve?${params.toString()}`,
          { signal: controller.signal },
        )
        setAccountPreview(result.resolution)
        if (!userEditedAccountCode) {
          setAccountCodeDraft(result.resolution.formattedAccountCode)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setAccountPreview(null)
        setAccountPreviewError(
          error instanceof Error ? error.message : "No se pudo resolver la subcuenta contable.",
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAccount(false)
        }
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [
    formData.cif,
    formData.proveedor,
    thirdPartyType,
    selectedPrefix,
    documentType,
    userEditedAccountCode,
    accountCodeDraft,
  ])

  useEffect(() => {
    if (documentType === "factura-emitida" || userOverrodeAccounts) return
    if (
      formData.proveedor === initialData.proveedor &&
      formData.numeroFactura === initialData.numeroFactura
    ) {
      return
    }

    const classified = classifyReceivedInvoicePurchase({
      proveedor: formData.proveedor,
      numeroFactura: formData.numeroFactura,
      fileName,
      naturalezaCompra: formData.naturalezaCompra,
    })
    setFormData((prev) => {
      if (
        prev.accountPrefix === classified.accountPrefix &&
        prev.expenseAccount === classified.expenseAccount &&
        prev.classificationReason === classified.reason
      ) {
        return prev
      }
      return {
        ...prev,
        accountPrefix: classified.accountPrefix,
        expenseAccount: classified.expenseAccount,
        classificationReason: classified.reason,
      }
    })
  }, [
    documentType,
    userOverrodeAccounts,
    formData.proveedor,
    formData.numeroFactura,
    formData.naturalezaCompra,
    fileName,
    initialData.proveedor,
    initialData.numeroFactura,
  ])

  const applyUpdate = (updater: (prev: InvoiceOcrResult) => InvoiceOcrResult) => {
    setFormData((prev) => syncInvoiceTotals(updater(prev)))
  }

  const updateField = <K extends keyof InvoiceOcrResult>(field: K, value: InvoiceOcrResult[K]) => {
    applyUpdate((prev) => ({ ...prev, [field]: value }))
  }

  const updateDesgloseLine = (index: number, patch: Partial<IvaDesgloseLine>) => {
    applyUpdate((prev) => {
      const iva_desglose = prev.iva_desglose.map((line, i) => {
        if (i !== index) return line

        const updated = { ...line, ...patch }

        if ("base_imponible" in patch || "tipo_iva" in patch) {
          if (!prev.isSujetoPasivo) {
            updated.cuota_iva = calculateCuotaIva(updated.base_imponible, updated.tipo_iva)
          } else {
            updated.cuota_iva = 0
          }
        }

        return updated
      })

      return { ...prev, iva_desglose }
    })
  }

  const addDesgloseLine = () => {
    applyUpdate((prev) => ({
      ...prev,
      iva_desglose: [...prev.iva_desglose, createEmptyDesgloseLine()],
    }))
  }

  const removeDesgloseLine = (index: number) => {
    applyUpdate((prev) => ({
      ...prev,
      iva_desglose:
        prev.iva_desglose.length > 1
          ? prev.iva_desglose.filter((_, i) => i !== index)
          : prev.iva_desglose,
    }))
  }

  const toggleRecargo = (enabled: boolean) => {
    applyUpdate((prev) => ({
      ...prev,
      recargo_equivalencia: enabled ? { porcentaje: 5.2, cuota: 0 } : null,
    }))
  }

  const updateRecargo = (field: "porcentaje" | "cuota", value: number) => {
    applyUpdate((prev) => ({
      ...prev,
      recargo_equivalencia: {
        porcentaje: field === "porcentaje" ? value : (prev.recargo_equivalencia?.porcentaje ?? 0),
        cuota: field === "cuota" ? value : (prev.recargo_equivalencia?.cuota ?? 0),
      },
    }))
  }

  const handlePrefixChange = (prefix: ReceivedAccountPrefix) => {
    setUserOverrodeAccounts(true)
    setUserEditedAccountCode(false)
    applyUpdate((prev) => ({
      ...prev,
      accountPrefix: prefix,
      expenseAccount:
        prefix === "400" && (prev.expenseAccount ?? "").startsWith("62")
          ? "600"
          : prefix === "410" && (prev.expenseAccount === "600" || !prev.expenseAccount)
            ? "629"
            : prev.expenseAccount,
      classificationReason: "Clasificación revisada al confirmar la factura.",
    }))
  }

  const handleAccountCodeDraftChange = (value: string) => {
    setUserEditedAccountCode(true)
    setUserOverrodeAccounts(true)
    setAccountCodeDraft(value)
    const digits = value.replace(/\D/g, "")
    if (digits.startsWith("410") && formData.accountPrefix !== "410") {
      updateField("accountPrefix", "410")
    } else if (digits.startsWith("400") && formData.accountPrefix !== "400") {
      updateField("accountPrefix", "400")
    } else if (digits.startsWith("430") && documentType === "factura-emitida") {
      updateField("accountPrefix", "430")
    }
  }

  const handleExpenseChange = (expenseAccount: string) => {
    setUserOverrodeAccounts(true)
    updateField("expenseAccount", expenseAccount)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(
      syncInvoiceTotals({
        ...formData,
        cif: normalizeTaxId(formData.cif),
        preferredAccountCode: accountCodeDraft.trim() || undefined,
      }),
    )
  }

  const ivaLinesDisabled = formData.isSujetoPasivo
  const showRecargo = !formData.isSujetoPasivo && !formData.isIntracomunitaria

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="order-1 xl:order-2 xl:sticky xl:top-4">
        <InvoiceDocumentPreview file={file} fileName={fileName} />
      </div>
    <Card className="order-2 border-emerald-200 shadow-md xl:order-1">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <ScanLine className="h-5 w-5" />
              Validación de factura
            </CardTitle>
            <CardDescription>
              Contrasta la factura original, el tipo de tercero (400 o 410) y el desglose de IVA
              antes de contabilizar.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{fileName}</span>
          {progressLabel ? <span className="ml-auto shrink-0 font-medium text-emerald-800">{progressLabel}</span> : null}
        </div>

        {(formData.isIntracomunitaria || formData.isSujetoPasivo) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {formData.isIntracomunitaria && (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                <Globe className="mr-1 h-3 w-3" />
                Operación intracomunitaria
              </Badge>
            )}
            {formData.isSujetoPasivo && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <Scale className="mr-1 h-3 w-3" />
                Inversión del sujeto pasivo
              </Badge>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="proveedor">{thirdPartyLabel}</Label>
              <Input
                id="proveedor"
                value={formData.proveedor}
                onChange={(e) => updateField("proveedor", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cif">CIF / VAT</Label>
              <Input
                id="cif"
                value={formData.cif}
                onChange={(e) => updateField("cif", normalizeTaxId(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroFactura">Número de factura</Label>
              <Input
                id="numeroFactura"
                value={formData.numeroFactura}
                onChange={(e) => updateField("numeroFactura", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fechaFactura">Fecha de factura</Label>
              <Input
                id="fechaFactura"
                type="date"
                value={formData.fechaFactura}
                onChange={(e) => updateField("fechaFactura", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-sm font-medium text-emerald-900">
              {documentType === "factura-emitida" ? "Subcuenta de cliente (430)" : "Tercero y cuenta de gasto"}
            </p>
            {documentType !== "factura-emitida" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="accountPrefix" className="text-xs text-emerald-800">
                    Tipo de ficha
                  </Label>
                  <select
                    id="accountPrefix"
                    value={selectedPrefix}
                    onChange={(e) => handlePrefixChange(e.target.value as ReceivedAccountPrefix)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="410">410 · Acreedor (servicios)</option>
                    <option value="400">400 · Proveedor (mercaderías)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preferredAccountCode" className="text-xs text-emerald-800">
                    Subcuenta del tercero
                  </Label>
                  <Input
                    id="preferredAccountCode"
                    value={accountCodeDraft}
                    onChange={(e) => handleAccountCodeDraftChange(e.target.value)}
                    className="h-9 font-mono"
                    placeholder="410.2 · 410.0002"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="expenseAccount" className="text-xs text-emerald-800">
                    Cuenta de gasto
                  </Label>
                  <Input
                    id="expenseAccount"
                    list="ocr-expense-accounts"
                    value={formData.expenseAccount ?? ""}
                    onChange={(e) => handleExpenseChange(e.target.value)}
                    className="h-9 font-mono"
                    placeholder="628 · 622.0001"
                  />
                  <datalist id="ocr-expense-accounts">
                    {PURCHASE_EXPENSE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                <Label htmlFor="preferredAccountCode" className="text-xs text-emerald-800">
                  Subcuenta del cliente
                </Label>
                <Input
                  id="preferredAccountCode"
                  value={accountCodeDraft}
                  onChange={(e) => handleAccountCodeDraftChange(e.target.value)}
                  className="h-9 font-mono"
                  placeholder="430.2 · 430.0002"
                />
              </div>
            )}
            {isLoadingAccount ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-emerald-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando ficha y último código disponible…
              </p>
            ) : accountPreviewError ? (
              <p className="mt-2 text-sm text-amber-800">{accountPreviewError}</p>
            ) : accountPreview ? (
              <div className="mt-2 space-y-1 text-sm text-emerald-900">
                <p>
                  <span className="font-mono font-semibold">{accountPreview.formattedAccountCode}</span>
                  {" · "}
                  {accountPreview.isNew ? (
                    <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Nueva ficha</Badge>
                  ) : (
                    <Badge variant="secondary">Ficha existente</Badge>
                  )}
                </p>
                <p className="text-xs text-emerald-800">
                  {accountPreview.isNew
                    ? `Puedes dejar la propuesta ${accountGroupLabel} o escribir otra, por ejemplo ${accountGroupLabel}.5.`
                    : `Este NIF ya tiene ficha. Si cambias el código (400 ↔ 410 o el número), se actualizará al confirmar.`}
                </p>
                {formData.classificationReason ? (
                  <p className="text-xs text-emerald-700">{formData.classificationReason}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Introduce el NIF/CIF para asignar la subcuenta.</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Régimen fiscal especial</p>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={formData.isIntracomunitaria}
                onChange={(e) => updateField("isIntracomunitaria", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm">
                <span className="font-medium">Operación intracomunitaria</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={formData.isSujetoPasivo}
                onChange={(e) => updateField("isSujetoPasivo", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="text-sm">
                <span className="font-medium">Inversión del sujeto pasivo</span>
                <span className="mt-0.5 block text-gray-500">Cuotas IVA a 0 (autoliquidación en España).</span>
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Desglose de IVA</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDesgloseLine}
                disabled={ivaLinesDisabled}
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir línea
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Base imponible (€)</th>
                    <th className="px-3 py-2 font-medium">Tipo IVA (%)</th>
                    <th className="px-3 py-2 font-medium">Cuota IVA (€)</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {formData.iva_desglose.map((line, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.base_imponible}
                          disabled={ivaLinesDisabled}
                          onChange={(e) =>
                            updateDesgloseLine(index, {
                              base_imponible: round2(parseFloat(e.target.value) || 0),
                            })
                          }
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={line.tipo_iva}
                          disabled={ivaLinesDisabled}
                          onChange={(e) =>
                            updateDesgloseLine(index, {
                              tipo_iva: Number(e.target.value) as TipoIva,
                            })
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {TIPOS_IVA.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {tipo}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.cuota_iva}
                          disabled={ivaLinesDisabled}
                          onChange={(e) =>
                            updateDesgloseLine(index, {
                              cuota_iva: round2(parseFloat(e.target.value) || 0),
                            })
                          }
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDesgloseLine(index)}
                          disabled={ivaLinesDisabled || formData.iva_desglose.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50 text-sm font-medium">
                  <tr>
                    <td className="px-3 py-2">{formatEuro(baseImponible)}</td>
                    <td className="px-3 py-2 text-gray-500">Subtotal IVA</td>
                    <td className="px-3 py-2" colSpan={2}>
                      {formatEuro(iva)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {showRecargo && (
            <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.recargo_equivalencia !== null}
                  onChange={(e) => toggleRecargo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-sm font-medium">Recargo de equivalencia</span>
              </label>

              {formData.recargo_equivalencia && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recargo-porcentaje">Porcentaje (%)</Label>
                    <Input
                      id="recargo-porcentaje"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.recargo_equivalencia.porcentaje}
                      onChange={(e) =>
                        updateRecargo("porcentaje", round2(parseFloat(e.target.value) || 0))
                      }
                    />
                    <p className="text-xs text-gray-500">Habitual: 5,2% · 1,4% · 0,5%</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recargo-cuota">Cuota recargo (€)</Label>
                    <Input
                      id="recargo-cuota"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.recargo_equivalencia.cuota}
                      onChange={(e) =>
                        updateRecargo("cuota", round2(parseFloat(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Base imponible total</span>
              <span className="font-medium">{formatEuro(baseImponible)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">IVA total</span>
              <span className="font-medium">{formatEuro(iva)}</span>
            </div>
            {formData.recargo_equivalencia && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Recargo equivalencia ({formData.recargo_equivalencia.porcentaje}%)
                </span>
                <span className="font-medium">{formatEuro(formData.recargo_equivalencia.cuota)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base">
              <span className="font-semibold text-emerald-800">Total calculado</span>
              <span className="font-bold text-emerald-800">{formatEuro(calculatedTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Total en factura (OCR)</span>
              <span>{formatEuro(ocrTotal)}</span>
            </div>
            {!totalsMatch && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs">
                  El total calculado no coincide con el de la factura. Revisa las líneas de IVA y el
                  recargo antes de confirmar.
                </p>
              </div>
            )}
            {totalsMatch && calculatedTotal > 0 && (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">Los importes cuadran con el total de la factura.</span>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              Descartar lote
            </Button>
            {onSkip && remainingCount > 0 ? (
              <Button type="button" variant="outline" onClick={onSkip} disabled={isSubmitting}>
                Saltar esta factura
              </Button>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-700 hover:bg-emerald-800">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar datos
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  )
}
