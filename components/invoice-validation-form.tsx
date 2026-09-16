"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CircleHelp,
  CheckCircle,
  Globe,
  Loader2,
  Plus,
  ScanLine,
  Scale,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import type { InvoiceOcrResult, IvaDesgloseLine, TipoIva } from "@/lib/types/invoice"
import {
  formatAccountCodeDisplay,
  type ThirdPartyResolution,
} from "@/lib/accounting/third-party-types"
import type { DuplicateInvoiceMatch } from "@/lib/accounting/duplicate-invoice"
import type { AccountExistenceResult } from "@/lib/accounting/account-exists-service"
import type { AccountTreatmentConfigDto } from "@/lib/accounting/account-treatment-types"
import { apiFetch } from "@/lib/api-client"
import { normalizeTaxId } from "@/lib/tax-id"
import { TIPOS_IVA } from "@/lib/types/invoice"
import { InvoiceDocumentPreview } from "@/components/invoice-document-preview"
import { MissingAccountDialog } from "@/components/accounting/missing-account-dialog"
import {
  NewSubaccountDialog,
  type AccountCreationResult,
} from "@/components/accounting/new-subaccount-dialog"
import {
  parseNewAccountPrefix,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"
import {
  classifyIssuedInvoiceIncome,
  classifyReceivedInvoicePurchase,
  PURCHASE_EXPENSE_OPTIONS,
  SALES_INCOME_OPTIONS,
  type ReceivedAccountPrefix,
} from "@/lib/accounting/invoice-supplier-classification"
import {
  DEFAULT_OCR_SETTINGS,
  firstShortcutForAction,
  matchOcrShortcut,
  type OcrWorkspaceSettings,
} from "@/lib/ocr/ocr-settings"
import { cn } from "@/lib/utils"
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
  ocrSettings?: OcrWorkspaceSettings
  enableShortcuts?: boolean
  onOpenSettings?: () => void
  onConfirm: (
    data: InvoiceOcrResult,
    options?: { allowDuplicate?: boolean; offerRememberCounterpartAccount?: boolean },
  ) => void
  onCancel: () => void
  onSkip?: () => void
  isSubmitting?: boolean
}

type OcrLedgerAccountField = "expenseAccount" | "incomeAccount"

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

function FieldHelp({ text }: { text: string }) {
  return (
    <span
      className="inline-flex size-3.5 shrink-0 cursor-help items-center justify-center text-gray-400 hover:text-emerald-700"
      title={text}
      aria-label={text}
    >
      <CircleHelp className="size-3.5" />
    </span>
  )
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
  ocrSettings = DEFAULT_OCR_SETTINGS,
  enableShortcuts = true,
  onOpenSettings,
  onConfirm,
  onCancel,
  onSkip,
  isSubmitting = false,
}: InvoiceValidationFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const ledgerAccountCheckRef = useRef<{
    key: string
    promise: Promise<string | null>
  } | null>(null)
  const ledgerAccountPromptKeyRef = useRef<string | null>(null)
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
  const [mobilePane, setMobilePane] = useState<"document" | "data">("data")
  const [missingLedgerAccount, setMissingLedgerAccount] =
    useState<AccountExistenceResult | null>(null)
  const [pendingLedgerField, setPendingLedgerField] =
    useState<OcrLedgerAccountField | null>(null)
  const [newSubaccountPrefix, setNewSubaccountPrefix] =
    useState<NewAccountPrefix | null>(null)
  const [fixedAccountCode, setFixedAccountCode] = useState<string | null>(null)
  const [ledgerAccountError, setLedgerAccountError] = useState<string | null>(null)
  const [newLedgerAccountCreated, setNewLedgerAccountCreated] = useState(false)

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
  const isolatePages =
    ocrSettings.isolateCurrentInvoice &&
    Boolean(pageStart) &&
    (invoiceCount > 1 || Boolean(formData.pagina))

  const { baseImponible, iva } = useMemo(
    () => sumDesglose(formData.iva_desglose),
    [formData.iva_desglose],
  )

  const calculatedTotal = useMemo(
    () => calculateTotalFromBreakdown(formData.iva_desglose, formData.recargo_equivalencia),
    [formData.iva_desglose, formData.recargo_equivalencia],
  )

  const totalsMatch = Math.abs(calculatedTotal - ocrTotal) < 0.02
  const duplicateBlocked = Boolean(duplicate && ocrSettings.blockDuplicates && !allowDuplicate)
  const totalsBlocked = ocrSettings.requireTotalsMatch && !totalsMatch
  const cifBlocked = ocrSettings.requireCif && !formData.cif.trim()
  const confirmBlocked = duplicateBlocked || totalsBlocked || cifBlocked
  const confirmShortcut = firstShortcutForAction(ocrSettings.shortcuts, "confirm")
  const skipShortcut = firstShortcutForAction(ocrSettings.shortcuts, "skip")

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
        if (!userOverrodeAccounts) {
          try {
            const treatmentResult = await apiFetch<{
              success: true
              treatment: AccountTreatmentConfigDto | null
            }>(
              `/api/accounting/account-treatment?accountCode=${encodeURIComponent(result.resolution.accountCode)}`,
              { signal: controller.signal },
            )
            const counterpart = treatmentResult.treatment?.defaultCounterpartAccount?.trim()
            if (counterpart && !controller.signal.aborted) {
              const field: OcrLedgerAccountField =
                documentType === "factura-emitida" ? "incomeAccount" : "expenseAccount"
              setFormData((prev) => ({
                ...prev,
                [field]: formatAccountCodeDisplay(counterpart),
                classificationReason: "Cuenta habitual guardada para este tercero.",
              }))
            }
          } catch {
            // La ficha del tercero sigue siendo válida aunque no haya parametrización guardada.
          }
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
    userOverrodeAccounts,
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
      if (!enableShortcuts) return
      const action = matchOcrShortcut(ocrSettings.shortcuts, event)
      if (!action) return

      event.preventDefault()
      if (isSubmitting) return
      if (action === "confirm" && !confirmBlocked) formRef.current?.requestSubmit()
      if (action === "skip") {
        if (onSkip) onSkip()
        else onCancel()
      }
      if (action === "discard") onCancel()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    confirmBlocked,
    enableShortcuts,
    isSubmitting,
    ocrSettings.shortcuts,
    onCancel,
    onSkip,
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

  const handleIncomeChange = (incomeAccount: string) => {
    setUserOverrodeAccounts(true)
    updateField("incomeAccount", incomeAccount)
  }

  const setLedgerAccountValue = (field: OcrLedgerAccountField, value: string) => {
    setUserOverrodeAccounts(true)
    updateField(field, value)
  }

  const checkLedgerAccount = (
    field: OcrLedgerAccountField,
    rawValue: string,
  ): Promise<string | null> => {
    const value = rawValue.trim()
    const key = `${field}:${value}`
    if (ledgerAccountPromptKeyRef.current === key) {
      return Promise.resolve(null)
    }
    if (ledgerAccountCheckRef.current?.key === key) {
      return ledgerAccountCheckRef.current.promise
    }

    const promise = (async (): Promise<string | null> => {
      if (!value) {
        setLedgerAccountError(null)
        return ""
      }

      const createPrefix = parseNewAccountPrefix(value)
      if (createPrefix) {
        ledgerAccountPromptKeyRef.current = key
        setPendingLedgerField(field)
        setFixedAccountCode(null)
        setNewSubaccountPrefix(createPrefix)
        return null
      }

      setLedgerAccountError(null)
      try {
        const year =
          Number.parseInt(formData.fechaFactura.slice(0, 4), 10) || new Date().getFullYear()
        const result = await apiFetch<{ success: true; year: number } & AccountExistenceResult>(
          `/api/accounting/accounts/exists?code=${encodeURIComponent(value)}&year=${year}`,
        )

        if (!result.exists) {
          ledgerAccountPromptKeyRef.current = key
          setPendingLedgerField(field)
          setMissingLedgerAccount(result)
          if (result.formattedAccountCode) {
            setLedgerAccountValue(field, result.formattedAccountCode)
          }
          return null
        }

        const resolved = result.formattedAccountCode || value
        if (resolved !== rawValue) setLedgerAccountValue(field, resolved)
        return resolved
      } catch (error) {
        setLedgerAccountError(
          error instanceof Error ? error.message : "No se pudo comprobar la cuenta contable.",
        )
        return null
      }
    })()

    ledgerAccountCheckRef.current = { key, promise }
    void promise.finally(() => {
      if (ledgerAccountCheckRef.current?.promise === promise) {
        ledgerAccountCheckRef.current = null
      }
    })
    return promise
  }

  const handleMissingLedgerAccountConfirm = () => {
    if (!missingLedgerAccount?.parentCode) return
    setFixedAccountCode(missingLedgerAccount.accountCode)
    setNewSubaccountPrefix(missingLedgerAccount.parentCode)
    setMissingLedgerAccount(null)
  }

  const handleSubaccountCreated = (result: AccountCreationResult) => {
    if (pendingLedgerField) {
      setLedgerAccountValue(pendingLedgerField, result.resolution.formattedAccountCode)
    }
    setPendingLedgerField(null)
    setFixedAccountCode(null)
    setNewSubaccountPrefix(null)
    setLedgerAccountError(null)
    setNewLedgerAccountCreated(true)
    ledgerAccountPromptKeyRef.current = null
  }

  const closeNewSubaccount = () => {
    setNewSubaccountPrefix(null)
    setFixedAccountCode(null)
    setPendingLedgerField(null)
    ledgerAccountPromptKeyRef.current = null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (confirmBlocked) return

    const ledgerField: OcrLedgerAccountField =
      documentType === "factura-emitida" ? "incomeAccount" : "expenseAccount"
    const ledgerValue =
      ledgerField === "incomeAccount" ? formData.incomeAccount ?? "" : formData.expenseAccount ?? ""
    const resolvedLedgerAccount = await checkLedgerAccount(ledgerField, ledgerValue)
    if (resolvedLedgerAccount === null) return

    onConfirm(
      syncInvoiceTotals({
        ...formData,
        [ledgerField]: resolvedLedgerAccount || undefined,
        cif: normalizeTaxId(formData.cif),
        preferredAccountCode: accountCodeDraft.trim() || undefined,
      }),
      {
        allowDuplicate: Boolean(duplicate) && allowDuplicate,
        offerRememberCounterpartAccount: newLedgerAccountCreated,
      },
    )
  }

  const ivaLinesDisabled = formData.isSujetoPasivo
  const showRecargo = !formData.isSujetoPasivo && !formData.isIntracomunitaria

  return (
    <div className="space-y-2 pb-20 lg:pb-0">
      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-end gap-1 border-t border-emerald-200 bg-white/95 p-2 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:sticky lg:top-0 lg:inset-auto lg:z-30 lg:justify-between lg:rounded-lg lg:border lg:px-3 lg:py-2 lg:shadow-sm">
        <div className="hidden min-w-0 text-sm text-gray-600 lg:block">
          <p className="flex items-center gap-2 font-medium text-emerald-900">
            <ScanLine className="h-4 w-4 shrink-0" />
            <span className="truncate">{fileName}</span>
          </p>
          {progressLabel ? <p className="mt-0.5 text-xs text-emerald-800">{progressLabel}</p> : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 lg:flex-none lg:gap-2">
          {onOpenSettings ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={onOpenSettings}
              disabled={isSubmitting}
              title="Configurar OCR"
              aria-label="Configurar OCR"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden xl:inline">Configurar OCR</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            Descartar lote
          </Button>
          {onSkip && remainingCount > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onSkip} disabled={isSubmitting}>
              Saltar
              {skipShortcut ? (
                <kbd className="ml-1 hidden rounded border bg-white px-1 text-[10px] text-gray-500 sm:inline">
                  {skipShortcut}
                </kbd>
              ) : null}
            </Button>
          ) : onSkip ? (
            <Button type="button" variant="outline" size="sm" onClick={onSkip} disabled={isSubmitting}>
              Eliminar
              {skipShortcut ? (
                <kbd className="ml-1 hidden rounded border bg-white px-1 text-[10px] text-gray-500 sm:inline">
                  {skipShortcut}
                </kbd>
              ) : null}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || confirmBlocked}
            className="bg-emerald-700 px-3 hover:bg-emerald-800"
            onClick={() => formRef.current?.requestSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirmar
                {confirmShortcut ? (
                  <kbd className="ml-1 hidden rounded border border-emerald-500/40 bg-emerald-800/40 px-1 text-[10px] sm:inline">
                    {confirmShortcut}
                  </kbd>
                ) : null}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-gray-50 p-1 lg:hidden">
        <Button
          type="button"
          size="sm"
          variant={mobilePane === "document" ? "default" : "ghost"}
          className={mobilePane === "document" ? "bg-emerald-700 hover:bg-emerald-800" : ""}
          onClick={() => setMobilePane("document")}
        >
          Ver documento
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mobilePane === "data" ? "default" : "ghost"}
          className={mobilePane === "data" ? "bg-emerald-700 hover:bg-emerald-800" : ""}
          onClick={() => setMobilePane("data")}
        >
          Datos OCR
        </Button>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card
          className={cn(
            "border-emerald-200 shadow-sm",
            mobilePane !== "data" && "hidden lg:block",
          )}
        >
          <CardHeader className="px-3 py-2.5">
            <CardTitle className="text-base text-emerald-800">
              {documentType === "factura-emitida" ? "Validación de venta" : "Validación de compra"}
            </CardTitle>
            <CardDescription className="text-xs">
              {documentType === "factura-emitida"
                ? "Revisa importes, cliente e ingreso."
                : "Revisa importes, tercero y gasto."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            <div className="rounded-md border bg-gray-50 px-2.5 py-2 text-xs">
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
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
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
                <p className="font-medium">Posible factura duplicada</p>
                <p className="mt-0.5">
                  Ya existe el asiento {duplicate.refNumber} con el nº {duplicate.invoiceNumber} (
                  {new Date(`${duplicate.fecha}T00:00:00`).toLocaleDateString("es-ES")}).
                </p>
                <label className="mt-1.5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(event) => setAllowDuplicate(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-amber-400 text-emerald-700"
                  />
                  <span>
                    {ocrSettings.blockDuplicates
                      ? "Registrar de todos modos. La detección de duplicadas está activa."
                      : "Confirmar aunque coincida con un asiento anterior."}
                  </span>
                </label>
              </div>
            ) : null}

            {totalsBlocked || cifBlocked ? (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {cifBlocked
                  ? "La configuración OCR exige un NIF/CIF antes de confirmar."
                  : "La configuración OCR exige que el total calculado cuadre con la factura."}
              </div>
            ) : null}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-2.5">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(130px,0.8fr)_minmax(130px,0.8fr)]">
                <div className="space-y-1">
                  <Label htmlFor="proveedor">{thirdPartyLabel}</Label>
                  <Input
                    id="proveedor"
                    value={formData.proveedor}
                    onChange={(e) => updateField("proveedor", e.target.value)}
                    className="h-8"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cif">CIF / VAT</Label>
                  <Input
                    id="cif"
                    value={formData.cif}
                    onChange={(e) => updateField("cif", normalizeTaxId(e.target.value))}
                    className="h-8"
                    required={ocrSettings.requireCif}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="numeroFactura">Número de factura</Label>
                  <Input
                    id="numeroFactura"
                    value={formData.numeroFactura}
                    onChange={(e) => updateField("numeroFactura", e.target.value)}
                    className="h-8"
                    required
                  />
                </div>
              </div>

              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5">
                {documentType !== "factura-emitida" ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="fechaFactura" className="flex h-4 items-center text-xs leading-none text-emerald-800">
                        Fecha
                      </Label>
                      <Input
                        id="fechaFactura"
                        type="date"
                        value={formData.fechaFactura}
                        onChange={(e) => updateField("fechaFactura", e.target.value)}
                        className="h-8"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="accountPrefix" className="flex h-4 items-center text-xs leading-none text-emerald-800">
                        Tipo de ficha
                      </Label>
                      <select
                        id="accountPrefix"
                        value={selectedPrefix}
                        onChange={(e) => handlePrefixChange(e.target.value as ReceivedAccountPrefix)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="410">410 · Acreedor (servicios)</option>
                        <option value="400">400 · Proveedor (mercaderías)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="expenseAccount" className="flex h-4 items-center gap-1 text-xs leading-none text-emerald-800">
                        Cuenta de gasto
                        <FieldHelp text="Puedes usar una cuenta general (628) o una subcuenta propia (628.0001). 628.1 se guarda como 628.0001." />
                      </Label>
                      <Input
                        id="expenseAccount"
                        list="ocr-expense-accounts"
                        value={formData.expenseAccount ?? ""}
                        onChange={(e) => handleExpenseChange(e.target.value)}
                        onBlur={(e) => void checkLedgerAccount("expenseAccount", e.target.value)}
                        className="h-8 font-mono text-xs"
                        placeholder="628 · 628.1 · 628.0001"
                      />
                      <datalist id="ocr-expense-accounts">
                        {PURCHASE_EXPENSE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label htmlFor="preferredAccountCode" className="flex h-4 items-center gap-1 text-xs leading-none text-emerald-800">
                        Subcuenta del tercero
                        <FieldHelp text="Se reutiliza la ficha del mismo NIF; puedes corregir aquí el código propuesto." />
                      </Label>
                      <Input
                        id="preferredAccountCode"
                        value={accountCodeDraft}
                        onChange={(e) => handleAccountCodeDraftChange(e.target.value)}
                        className="h-8 font-mono text-xs sm:max-w-xs"
                        placeholder="410.2 · 410.0002"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="fechaFactura" className="flex h-4 items-center text-xs leading-none text-emerald-800">
                        Fecha
                      </Label>
                      <Input
                        id="fechaFactura"
                        type="date"
                        value={formData.fechaFactura}
                        onChange={(e) => updateField("fechaFactura", e.target.value)}
                        className="h-8"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="preferredAccountCode" className="flex h-4 items-center text-xs leading-none text-emerald-800">
                        Subcuenta del cliente
                      </Label>
                      <Input
                        id="preferredAccountCode"
                        value={accountCodeDraft}
                        onChange={(e) => handleAccountCodeDraftChange(e.target.value)}
                        className="h-8 font-mono text-xs"
                        placeholder="430.2 · 430.0002"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="incomeAccount" className="flex h-4 items-center gap-1 text-xs leading-none text-emerald-800">
                        Cuenta de ingreso
                        <FieldHelp text="Puedes usar una cuenta general (705) o una subcuenta propia (705.0001). 705.1 se guarda como 705.0001." />
                      </Label>
                      <Input
                        id="incomeAccount"
                        list="ocr-income-accounts"
                        value={formData.incomeAccount ?? ""}
                        onChange={(e) => handleIncomeChange(e.target.value)}
                        onBlur={(e) => void checkLedgerAccount("incomeAccount", e.target.value)}
                        className="h-8 font-mono text-xs"
                        placeholder="705 · 705.1 · 705.0001"
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
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Buscando ficha…
                  </p>
                ) : accountPreviewError ? (
                  <p className="mt-1.5 text-xs text-amber-800">{accountPreviewError}</p>
                ) : accountPreview ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-emerald-900">
                    <p className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold">{accountPreview.formattedAccountCode}</span>
                      {accountPreview.isNew ? (
                        <Badge className="h-5 bg-emerald-700 px-1.5 text-[10px] text-white hover:bg-emerald-700">Nueva ficha</Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Ficha existente</Badge>
                      )}
                    </p>
                    <FieldHelp
                      text={
                        accountPreview.isNew
                          ? `Puedes aceptar la propuesta ${accountGroupLabel} o escribir otra subcuenta.`
                          : "Este NIF ya tiene ficha. El código se reutilizará al confirmar."
                      }
                    />
                    {formData.classificationReason ? (
                      <FieldHelp text={formData.classificationReason} />
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-500">Introduce el NIF/CIF para asignar la subcuenta.</p>
                )}
                {ledgerAccountError ? (
                  <p className="mt-1.5 text-xs text-red-700">{ledgerAccountError}</p>
                ) : null}
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={formData.isIntracomunitaria}
                    onChange={(e) => updateField("isIntracomunitaria", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <Globe className="h-3.5 w-3.5 text-blue-700" />
                  Intracomunitaria
                </label>

                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={formData.isSujetoPasivo}
                    onChange={(e) => updateField("isSujetoPasivo", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <Scale className="h-3.5 w-3.5 text-amber-700" />
                  Inversión sujeto pasivo
                  <FieldHelp text="Pone las cuotas de IVA a cero para la autoliquidación en España." />
                </label>

                {showRecargo ? (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={formData.recargo_equivalencia !== null}
                      onChange={(e) => toggleRecargo(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    Recargo equivalencia
                  </label>
                ) : null}
                </div>

                {formData.recargo_equivalencia ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="recargo-porcentaje" className="text-xs">
                        Recargo %
                      </Label>
                      <Input
                        id="recargo-porcentaje"
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.recargo_equivalencia.porcentaje}
                        onChange={(e) =>
                          updateRecargo("porcentaje", round2(parseFloat(e.target.value) || 0))
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="recargo-cuota" className="text-xs">
                        Cuota recargo €
                      </Label>
                      <Input
                        id="recargo-cuota"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.recargo_equivalencia.cuota}
                        onChange={(e) =>
                          updateRecargo("cuota", round2(parseFloat(e.target.value) || 0))
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Desglose de IVA</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={addDesgloseLine}
                    disabled={ivaLinesDisabled}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Añadir línea
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[500px] text-xs">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Base imponible (€)</th>
                        <th className="px-2 py-1.5 font-medium">IVA (%)</th>
                        <th className="px-2 py-1.5 font-medium">Cuota IVA (€)</th>
                        <th className="w-9 px-1 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {formData.iva_desglose.map((line, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-2 py-1">
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
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={line.tipo_iva}
                              disabled={ivaLinesDisabled}
                              onChange={(e) =>
                                updateDesgloseLine(index, {
                                  tipo_iva: Number(e.target.value) as TipoIva,
                                })
                              }
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            >
                              {TIPOS_IVA.map((tipo) => (
                                <option key={tipo} value={tipo}>
                                  {tipo}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
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
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => removeDesgloseLine(index)}
                              disabled={ivaLinesDisabled || formData.iva_desglose.length <= 1}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-gray-50 text-xs font-medium">
                      <tr>
                        <td className="px-2 py-1.5">{formatEuro(baseImponible)}</td>
                        <td className="px-2 py-1.5 text-gray-500">Subtotal IVA</td>
                        <td className="px-2 py-1.5" colSpan={2}>
                          {formatEuro(iva)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </form>
          </CardContent>
        </Card>

        <div
          className={cn(
            "lg:sticky lg:top-14",
            mobilePane !== "document" && "hidden lg:block",
          )}
        >
          <InvoiceDocumentPreview
            file={file}
            fileName={fileName}
            pageStart={pageStart}
            pageEnd={pageEnd}
            isolatePages={isolatePages}
          />
        </div>
      </div>

      <MissingAccountDialog
        open={missingLedgerAccount !== null}
        year={Number.parseInt(formData.fechaFactura.slice(0, 4), 10) || new Date().getFullYear()}
        account={missingLedgerAccount}
        onConfirm={handleMissingLedgerAccountConfirm}
        onCancel={() => {
          setMissingLedgerAccount(null)
          setPendingLedgerField(null)
          ledgerAccountPromptKeyRef.current = null
        }}
      />
      <NewSubaccountDialog
        open={newSubaccountPrefix !== null}
        prefix={newSubaccountPrefix}
        fixedAccountCode={fixedAccountCode}
        onClose={closeNewSubaccount}
        onCreated={handleSubaccountCreated}
      />
    </div>
  )
}
