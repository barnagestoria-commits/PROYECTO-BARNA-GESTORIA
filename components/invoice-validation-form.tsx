"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle,
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
  classifyIssuedInvoiceIncome,
  classifyReceivedInvoicePurchase,
  PURCHASE_EXPENSE_OPTIONS,
  SALES_INCOME_OPTIONS,
  type ReceivedAccountPrefix,
} from "@/lib/accounting/invoice-supplier-classification"
import type { DuplicateInvoiceMatch } from "@/lib/accounting/duplicate-invoice"
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
  invoiceIndex?: number
  invoiceCount?: number
  ocrBlockDuplicates?: boolean
  onConfirm: (data: InvoiceOcrResult, options?: { allowDuplicate?: boolean }) => void
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
  invoiceIndex = 1,
  invoiceCount = 1,
  ocrBlockDuplicates = true,
  onConfirm,
  onCancel,
  onSkip,
  isSubmitting = false,
}: InvoiceValidationFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [formData, setFormData] = useState<InvoiceOcrResult>(() => {
    const seeded = syncInvoiceTotals({
      ...initialData,
      cif: normalizeTaxId(initialData.cif),
    })
    if (documentType === "factura-emitida") {
      const classified = classifyIssuedInvoiceIncome({
        proveedor: seeded.proveedor,
        numeroFactura: seeded.numeroFactura,
        fileName,
      })
      return {
        ...seeded,
        accountPrefix: "430",
        incomeAccount: seeded.incomeAccount ?? classified.incomeAccount,
        classificationReason: seeded.classificationReason ?? classified.reason,
      }
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
  const [duplicate, setDuplicate] = useState<DuplicateInvoiceMatch | null>(null)
  const [allowDuplicate, setAllowDuplicate] = useState(false)

  const thirdPartyType = documentType === "factura-emitida" ? "CLIENTE" : "PROVEEDOR"
  const thirdPartyLabel = documentType === "factura-emitida" ? "Cliente" : "Proveedor"
  const selectedPrefix: ReceivedAccountPrefix | "430" =
    documentType === "factura-emitida"
      ? "430"
      : formData.accountPrefix === "400" || formData.accountPrefix === "410"
        ? formData.accountPrefix
        : "410"
  const accountGroupLabel = selectedPrefix
  const pageStart = formData.pagina ?? (invoiceCount > 1 ? invoiceIndex : undefined)
  const pageEnd = formData.paginaFin ?? formData.pagina ?? pageStart
  const isolatePages = Boolean(pageStart) && (invoiceCount > 1 || Boolean(formData.pagina))

  const { baseImponible, iva } = useMemo(
    () => sumDesglose(formData.iva_desglose),
    [formData.iva_desglose],
  )

  const calculatedTotal = useMemo(
    () => calculateTotalFromBreakdown(formData.iva_desglose, formData.recargo_equivalencia),
    [formData.iva_desglose, formData.recargo_equivalencia],
  )

  const totalsMatch = Math.abs(calculatedTotal - ocrTotal) < 0.02
  const confirmBlocked = Boolean(duplicate && ocrBlockDuplicates && !allowDuplicate)

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
    const numeroFactura = formData.numeroFactura.trim()
    if (!numeroFactura) {
      setDuplicate(null)
      setAllowDuplicate(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          documentType,
          cif: formData.cif.trim(),
          numeroFactura,
          fechaFactura: formData.fechaFactura,
          total: String(calculatedTotal || ocrTotal),
        })
        const result = await apiFetch<{ success: true; duplicate: DuplicateInvoiceMatch | null }>(
          `/api/invoices/duplicates?${params.toString()}`,
          { signal: controller.signal },
        )
        setDuplicate(result.duplicate)
        if (!result.duplicate) setAllowDuplicate(false)
      } catch {
        if (controller.signal.aborted) return
        setDuplicate(null)
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [documentType, formData.cif, formData.numeroFactura, formData.fechaFactura, calculatedTotal, ocrTotal])

  useEffect(() => {
    if (documentType === "factura-emitida") {
      if (userOverrodeAccounts) return
      if (
        formData.proveedor === initialData.proveedor &&
        formData.numeroFactura === initialData.numeroFactura
      ) {
        return
      }
      const classified = classifyIssuedInvoiceIncome({
        proveedor: formData.proveedor,
        numeroFactura: formData.numeroFactura,
        fileName,
      })
      setFormData((prev) => {
        if (
          prev.incomeAccount === classified.incomeAccount &&
          prev.classificationReason === classified.reason
        ) {
          return prev
        }
        return {
          ...prev,
          accountPrefix: "430",
          incomeAccount: classified.incomeAccount,
          classificationReason: classified.reason,
        }
      })
      return
    }

    if (userOverrodeAccounts) return
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F4") {
        event.preventDefault()
        if (!isSubmitting && !confirmBlocked) {
          formRef.current?.requestSubmit()
        }
      }
      if (event.key === "F12") {
        event.preventDefault()
        if (isSubmitting) return
        if (onSkip) onSkip()
        else onCancel()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [confirmBlocked, isSubmitting, onCancel, onSkip])

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

  const handleIncomeChange = (incomeAccount: string) => {
    setUserOverrodeAccounts(true)
    updateField("incomeAccount", incomeAccount)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (confirmBlocked) return
    onConfirm(
      syncInvoiceTotals({
        ...formData,
        cif: normalizeTaxId(formData.cif),
        preferredAccountCode: accountCodeDraft.trim() || undefined,
      }),
      { allowDuplicate: Boolean(duplicate) && allowDuplicate },
    )
  }

  const ivaLinesDisabled = formData.isSujetoPasivo
  const showRecargo = !formData.isSujetoPasivo && !formData.isIntracomunitaria

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-gray-600">
          <p className="flex items-center gap-2 font-medium text-emerald-900">
            <ScanLine className="h-4 w-4 shrink-0" />
            <span className="truncate">{fileName}</span>
          </p>
          {progressLabel ? <p className="mt-0.5 text-xs text-emerald-800">{progressLabel}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            <X className="mr-2 h-4 w-4" />
            Descartar lote
          </Button>
          {onSkip && remainingCount > 0 ? (
            <Button type="button" variant="outline" onClick={onSkip} disabled={isSubmitting}>
              Saltar esta factura
              <kbd className="ml-2 rounded border bg-white px-1.5 text-[10px] text-gray-500">F12</kbd>
            </Button>
          ) : onSkip ? (
            <Button type="button" variant="outline" onClick={onSkip} disabled={isSubmitting}>
              Eliminar esta factura
              <kbd className="ml-2 rounded border bg-white px-1.5 text-[10px] text-gray-500">F12</kbd>
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={isSubmitting || confirmBlocked}
            className="bg-emerald-700 hover:bg-emerald-800"
            onClick={() => formRef.current?.requestSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar datos
                <kbd className="ml-2 rounded border border-emerald-500/40 bg-emerald-800/40 px-1.5 text-[10px]">
                  F4
                </kbd>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-800">
              {documentType === "factura-emitida" ? "Validación de venta" : "Validación de compra"}
            </CardTitle>
            <CardDescription>
              {documentType === "factura-emitida"
                ? "Contrasta importes, cliente (430) e ingreso (700 o 705) con la factura de esta pantalla."
                : "Contrasta importes, tercero (400 o 410) y gasto con la factura de esta pantalla."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Base imponible</span>
                  <span className="font-medium">{formatEuro(baseImponible)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">IVA</span>
                  <span className="font-medium">{formatEuro(iva)}</span>
                </div>
                {formData.recargo_equivalencia ? (
                  <div className="flex justify-between gap-3 sm:col-span-2">
                    <span className="text-gray-600">
                      Recargo equivalencia ({formData.recargo_equivalencia.porcentaje}%)
                    </span>
                    <span className="font-medium">{formatEuro(formData.recargo_equivalencia.cuota)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t pt-2 text-base sm:col-span-2">
                  <span className="font-semibold text-emerald-800">Total calculado</span>
                  <span className="font-bold text-emerald-800">{formatEuro(calculatedTotal)}</span>
                </div>
                <div className="flex justify-between gap-3 text-gray-500 sm:col-span-2">
                  <span>Total en factura</span>
                  <span>{formatEuro(ocrTotal)}</span>
                </div>
              </div>
              {!totalsMatch ? (
                <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs">
                    El total calculado no coincide con el de la factura. Revisa las líneas de IVA antes de
                    confirmar.
                  </p>
                </div>
              ) : null}
              {totalsMatch && calculatedTotal > 0 ? (
                <div className="mt-2 flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">Los importes cuadran con el total de la factura.</span>
                </div>
              ) : null}
            </div>

            {duplicate ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">Factura duplicada</p>
                <p className="mt-1 text-xs">
                  Ya existe el asiento {duplicate.refNumber} con el nº {duplicate.invoiceNumber} (
                  {new Date(`${duplicate.fecha}T00:00:00`).toLocaleDateString("es-ES")}).
                </p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(event) => setAllowDuplicate(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-emerald-700"
                  />
                  <span>
                    {ocrBlockDuplicates
                      ? "Registrar de todos modos. La detección de duplicadas está activa."
                      : "Confirmar aunque coincida con un asiento anterior."}
                  </span>
                </label>
              </div>
            ) : null}

            {(formData.isIntracomunitaria || formData.isSujetoPasivo) && (
              <div className="flex flex-wrap gap-2">
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

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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
                  {documentType === "factura-emitida"
                    ? "Cliente y cuenta de ingreso"
                    : "Tercero y cuenta de gasto"}
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
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
                    <div className="space-y-1">
                      <Label htmlFor="incomeAccount" className="text-xs text-emerald-800">
                        Cuenta de ingreso
                      </Label>
                      <Input
                        id="incomeAccount"
                        list="ocr-income-accounts"
                        value={formData.incomeAccount ?? ""}
                        onChange={(e) => handleIncomeChange(e.target.value)}
                        className="h-9 font-mono"
                        placeholder="705 · 700"
                      />
                      <datalist id="ocr-income-accounts">
                        {SALES_INCOME_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </datalist>
                    </div>
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
                        : documentType === "factura-emitida"
                          ? "Este NIF ya tiene ficha de cliente. Si cambias el código, se actualizará al confirmar."
                          : "Este NIF ya tiene ficha. Si cambias el código (400 ↔ 410 o el número), se actualizará al confirmar."}
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
                    <span className="mt-0.5 block text-gray-500">
                      Cuotas IVA a 0 (autoliquidación en España).
                    </span>
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
            </form>
          </CardContent>
        </Card>

        <div className="xl:sticky xl:top-16">
          <InvoiceDocumentPreview
            file={file}
            fileName={fileName}
            pageStart={pageStart}
            pageEnd={pageEnd}
            isolatePages={isolatePages}
          />
        </div>
      </div>
    </div>
  )
}
