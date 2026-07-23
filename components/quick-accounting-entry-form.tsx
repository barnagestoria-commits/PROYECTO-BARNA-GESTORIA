"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Scale,
  Trash2,
  Zap,
} from "lucide-react"
import type { AccountingCommandCode, AccountingEntryLine, EntryCellField } from "@/lib/types/accounting-entry"
import { ENTRY_CELL_FIELDS } from "@/lib/types/accounting-entry"
import {
  ACCOUNTING_COMMANDS,
  COMMAND_CODES,
  calculateTotals,
  createEmptyLine,
  formatEuro,
  linesFromTemplate,
  parseCommandInput,
  validateEntryLines,
} from "@/lib/accounting/command-templates"
import {
  createDefaultInvoiceDetails,
  type InvoiceEntryDetails,
} from "@/lib/types/invoice-entry-details"
import type { ThirdPartyAccountOption } from "@/lib/accounting/account-suggestions"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import {
  isEmitidaThirdPartyAccount,
} from "@/lib/accounting/account-suggestions"
import {
  isThirdPartyAccountPrefix,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"
import {
  applyInvoiceConceptsToLines,
  INVOICE_CONCEPT_PREFIX,
  isInvoiceConceptAccountLine,
  isInvoiceConceptCommand,
} from "@/lib/accounting/invoice-entry-concepts"
import {
  applyInvoiceAmountsToLines,
  applyTreatmentToEntryLines,
  applyTreatmentToInvoiceDetails,
} from "@/lib/accounting/invoice-auto-fill"
import type { AccountTreatmentConfigDto } from "@/lib/accounting/account-treatment-types"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { AccountCellInput } from "@/components/accounting/account-cell-input"
import { InvoiceEntryPanel } from "@/components/accounting/invoice-entry-panel"
import { NifAccountDialog } from "@/components/accounting/nif-account-dialog"
import { NewSubaccountDialog, type AccountCreationResult } from "@/components/accounting/new-subaccount-dialog"
import { PgcChartDialog } from "@/components/accounting/pgc-chart-dialog"
import { AccountMovementsDialog } from "@/components/accounting/account-movements-dialog"
import { CompanyExtractDialog } from "@/components/accounting/company-extract-dialog"
import { EditAccountingEntryDialog } from "@/components/accounting/edit-accounting-entry-dialog"
import { normalizeCuenta } from "@/lib/reports/format"
import { cn } from "@/lib/utils"

function cellKey(row: number, field: EntryCellField): string {
  return `${row}-${field}`
}

function parseAmount(value: string): number {
  const normalized = value.replace(",", ".").trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function isValidAccountValue(value: string): boolean {
  const digits = normalizeCuenta(value)
  return digits.length >= 2 && value.trim().toUpperCase() !== "EX"
}

function isInvoiceCommand(code: AccountingCommandCode | null): code is "17" | "34" {
  return code === "17" || code === "34"
}

export function QuickAccountingEntryForm() {
  const { activeCompany } = useAuth()
  const searchParams = useSearchParams()
  const [activeCommand, setActiveCommand] = useState<AccountingCommandCode | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [lines, setLines] = useState<AccountingEntryLine[]>([createEmptyLine()])
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceEntryDetails>(() =>
    createDefaultInvoiceDetails(new Date().toISOString().split("T")[0]),
  )
  const [commandHint, setCommandHint] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [focusedThirdParty, setFocusedThirdParty] = useState<string | null>(null)
  const [thirdParties, setThirdParties] = useState<ThirdPartyAccountOption[]>([])
  const [ledgerSubaccounts, setLedgerSubaccounts] = useState<LedgerSubaccountOption[]>([])
  const [activeCell, setActiveCell] = useState<{ row: number; field: EntryCellField }>({
    row: 0,
    field: "cuenta",
  })
  const [pgcDialogOpen, setPgcDialogOpen] = useState(false)
  const [nifDialogOpen, setNifDialogOpen] = useState(false)
  const [newSubaccountPrefix, setNewSubaccountPrefix] = useState<NewAccountPrefix | null>(null)
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false)
  const [movementsAccount, setMovementsAccount] = useState<string | null>(null)
  const [companyExtractOpen, setCompanyExtractOpen] = useState(false)
  const [editEntryId, setEditEntryId] = useState<string | null>(null)
  const [movementsRefreshKey, setMovementsRefreshKey] = useState(0)

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const lastAccountByRow = useRef<Map<number, string>>(new Map())

  const totals = useMemo(() => calculateTotals(lines), [lines])
  const lineValidations = useMemo(() => validateEntryLines(lines), [lines])
  const validationByLine = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const v of lineValidations) {
      const existing = map.get(v.lineId) ?? []
      map.set(v.lineId, [...existing, v.message])
    }
    return map
  }, [lineValidations])

  const showInvoicePanel = useMemo(() => {
    if (isInvoiceCommand(activeCommand)) return true
    return lines.some((line) => isThirdPartyAccountPrefix(line.cuenta))
  }, [activeCommand, lines])

  const invoiceMode = useMemo((): "emitida" | "recibida" => {
    if (activeCommand === "34") return "recibida"
    if (activeCommand === "17") return "emitida"
    if (lines.some((line) => isEmitidaThirdPartyAccount(line.cuenta))) return "emitida"
    return "recibida"
  }, [activeCommand, lines])

  const loadThirdParties = useCallback(async () => {
    if (!activeCompany?.id) {
      setThirdParties([])
      return
    }

    try {
      const data = await apiFetch<{ success: true; thirdParties: ThirdPartyAccountOption[] }>(
        "/api/accounting/third-parties",
      )
      setThirdParties(data.thirdParties)
    } catch {
      setThirdParties([])
    }
  }, [activeCompany?.id])

  const loadLedgerSubaccounts = useCallback(async () => {
    if (!activeCompany?.id) {
      setLedgerSubaccounts([])
      return
    }

    try {
      const data = await apiFetch<{ success: true; subaccounts: LedgerSubaccountOption[] }>(
        "/api/accounting/ledger-subaccounts",
      )
      setLedgerSubaccounts(data.subaccounts)
    } catch {
      setLedgerSubaccounts([])
    }
  }, [activeCompany?.id])

  const registerRef = useCallback((row: number, field: EntryCellField, el: HTMLInputElement | null) => {
    const key = cellKey(row, field)
    if (el) {
      inputRefs.current.set(key, el)
    } else {
      inputRefs.current.delete(key)
    }
  }, [])

  const focusCell = useCallback((row: number, field: EntryCellField) => {
    setActiveCell({ row, field })
    const el = inputRefs.current.get(cellKey(row, field))
    el?.focus()
    el?.select()
  }, [])

  const focusNextCell = useCallback(
    (row: number, field: EntryCellField) => {
      const fieldIndex = ENTRY_CELL_FIELDS.indexOf(field)
      if (fieldIndex < ENTRY_CELL_FIELDS.length - 1) {
        focusCell(row, ENTRY_CELL_FIELDS[fieldIndex + 1])
        return
      }
      if (row < lines.length - 1) {
        focusCell(row + 1, "cuenta")
      } else {
        setLines((prev) => [...prev, createEmptyLine()])
        requestAnimationFrame(() => focusCell(row + 1, "cuenta"))
      }
    },
    [focusCell, lines.length],
  )

  const applyAccountTreatment = useCallback(
    async (accountCode: string, targetRow = 0) => {
      try {
        const data = await apiFetch<{ success: true; treatment: AccountTreatmentConfigDto | null }>(
          `/api/accounting/account-treatment?accountCode=${encodeURIComponent(accountCode)}`,
        )

        if (!data.treatment) return

        setInvoiceDetails((prev) => applyTreatmentToInvoiceDetails(prev, data.treatment!))
        setLines((prev) =>
          applyTreatmentToEntryLines(prev, data.treatment!, {
            activeCommand,
            thirdPartyRow: targetRow,
          }),
        )
      } catch {
        // Sin parametrización: se mantienen plantillas por defecto
      }
    },
    [activeCommand],
  )

  const applyAccountAssignment = useCallback(
    (
      assignment: { formattedAccountCode: string; name: string; cif?: string; accountCode?: string },
      targetRow = 0,
    ) => {
      lastAccountByRow.current.set(targetRow, assignment.formattedAccountCode)
      setLines((prev) =>
        prev.map((line, index) =>
          index === targetRow
            ? {
                ...line,
                cuenta: assignment.formattedAccountCode,
                concepto: assignment.name,
              }
            : line,
        ),
      )
      if (assignment.cif) {
        setFocusedThirdParty(assignment.name)
        setInvoiceDetails((prev) => ({
          ...prev,
          nif: assignment.cif ?? prev.nif,
          thirdPartyName: assignment.name,
        }))
      }
      void applyAccountTreatment(
        assignment.accountCode ?? assignment.formattedAccountCode,
        targetRow,
      )
      requestAnimationFrame(() => focusCell(targetRow, "debe"))
    },
    [applyAccountTreatment, focusCell],
  )

  const applyInvoiceTotals = useCallback(
    (amounts: { base: number; quota: number; total: number; irpf?: number }) => {
      setLines((prev) => {
        const withAmounts = applyInvoiceAmountsToLines(
          prev,
          {
            base: amounts.base,
            quota: amounts.quota,
            irpf: amounts.irpf ?? 0,
            total: amounts.total,
          },
          { activeCommand: activeCommand ?? undefined },
        )

        return isInvoiceConceptCommand(activeCommand)
          ? applyInvoiceConceptsToLines(withAmounts, activeCommand, invoiceDetails.invoiceNumber)
          : withAmounts
      })
    },
    [activeCommand, invoiceDetails.invoiceNumber],
  )

  const startManualEntry = useCallback(() => {
    setActiveCommand(null)
    setCommandHint(null)
    setLines([createEmptyLine()])
    setInvoiceDetails(createDefaultInvoiceDetails(fecha))
    requestAnimationFrame(() => focusCell(0, "cuenta"))
  }, [fecha, focusCell])

  const applyCommand = useCallback(
    async (code: AccountingCommandCode) => {
      setActiveCommand(code)
      setCommandHint(null)

      if (code === "303") {
        const year = new Date(fecha).getFullYear()
        const month = new Date(fecha).getMonth() + 1
        const quarter = (Math.ceil(month / 3) as 1 | 2 | 3 | 4)

        try {
          const data = await apiFetch<{
            success: true
            liquidation: {
              concept: string
              resultType: "pagar" | "compensar"
              settlementAccount: string
              saldoRepercutido: number
              saldoSoportado: number
              difference: number
            }
            lines: AccountingEntryLine[]
          }>(`/api/accounting/vat-liquidation?year=${year}&quarter=${quarter}`)

          setLines(data.lines)
          setCommandHint(
            `Liquidación T${quarter} ${year}: ${data.liquidation.resultType === "pagar" ? "A pagar" : "A compensar"} ${formatEuro(Math.abs(data.liquidation.difference))} → cuenta ${data.liquidation.settlementAccount}`,
          )
        } catch (err) {
          setLines(linesFromTemplate(code))
          setCommandHint(
            err instanceof Error ? err.message : "No se pudo calcular la liquidación de IVA.",
          )
        }
      } else {
        setLines(linesFromTemplate(code))
        setInvoiceDetails(createDefaultInvoiceDetails(fecha))
      }

      requestAnimationFrame(() => focusCell(0, "cuenta"))
    },
    [fecha, focusCell],
  )

  useEffect(() => {
    loadThirdParties()
    loadLedgerSubaccounts()
  }, [loadLedgerSubaccounts, loadThirdParties])

  useEffect(() => {
    lines.forEach((line, index) => {
      if (isValidAccountValue(line.cuenta)) {
        lastAccountByRow.current.set(index, line.cuenta)
      }
    })
  }, [lines])

  useEffect(() => {
    const comando = searchParams.get("comando")
    if (comando) {
      const code = parseCommandInput(comando)
      if (code) applyCommand(code)
    }

    const cuenta = searchParams.get("cuenta")?.trim()
    const tercero = searchParams.get("tercero")?.trim()
    if (cuenta) {
      setLines((prev) => {
        const next = prev.length > 0 ? [...prev] : [createEmptyLine()]
        next[0] = {
          ...next[0],
          cuenta,
          concepto: tercero || next[0].concepto,
        }
        return next
      })
      if (tercero) setFocusedThirdParty(tercero)
      requestAnimationFrame(() => focusCell(0, "debe"))
    }
  }, [searchParams, applyCommand, focusCell])

  useEffect(() => {
    if (!isInvoiceConceptCommand(activeCommand)) return
    setLines((prev) =>
      applyInvoiceConceptsToLines(prev, activeCommand, invoiceDetails.invoiceNumber),
    )
  }, [activeCommand, invoiceDetails.invoiceNumber])

  useEffect(() => {
    setInvoiceDetails((prev) => ({
      ...prev,
      issueDate: fecha,
      operationDate: fecha,
    }))
  }, [fecha])

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    row: number,
    field: EntryCellField,
  ) => {
    if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault()
      focusNextCell(row, field)
    }
  }

  const updateLine = (lineId: string, patch: Partial<AccountingEntryLine>) => {
    setLines((prev) =>
      prev.map((line, index) => {
        if (line.id !== lineId) return line
        const next = { ...line, ...patch }
        if (patch.cuenta !== undefined && isValidAccountValue(patch.cuenta)) {
          lastAccountByRow.current.set(index, patch.cuenta)
        }
        return next
      }),
    )
  }

  const openAccountExtract = useCallback((row: number, explicitAccount?: string) => {
    const account =
      explicitAccount ??
      (lines[row]?.cuenta && isValidAccountValue(lines[row].cuenta)
        ? lines[row].cuenta
        : lastAccountByRow.current.get(row) ??
          lines.find((line) => isValidAccountValue(line.cuenta))?.cuenta ??
          null)

    if (!account) {
      setSubmitError("Introduce una cuenta contable antes de consultar EX.")
      return
    }

    setSubmitError(null)
    setMovementsAccount(account)
    setMovementsDialogOpen(true)
  }, [lines])

  const openCompanyExtract = useCallback(() => {
    if (!activeCompany?.id) {
      setSubmitError("Selecciona una empresa cliente para consultar el extracto.")
      return
    }
    setSubmitError(null)
    setCompanyExtractOpen(true)
  }, [activeCompany?.id])

  const handleExtractAccountSelect = useCallback((accountCode: string) => {
    setMovementsAccount(accountCode)
    setMovementsDialogOpen(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "F4") {
        event.preventDefault()
        setPgcDialogOpen(true)
      }
      if (event.key === "F6") {
        event.preventDefault()
        setNifDialogOpen(true)
      }
      if (event.key === "F8") {
        event.preventDefault()
        openAccountExtract(activeCell.row)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeCell.row, openAccountExtract])

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev))
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
    requestAnimationFrame(() => focusCell(lines.length, "cuenta"))
  }

  const resetForm = useCallback(() => {
    setActiveCommand(null)
    setFecha(new Date().toISOString().split("T")[0])
    setLines([createEmptyLine()])
    setInvoiceDetails(createDefaultInvoiceDetails(new Date().toISOString().split("T")[0]))
    setCommandHint(null)
    setSubmitError(null)
    setFocusedThirdParty(null)
  }, [])

  const handleSubmit = async () => {
    if (!totals.isBalanced || isSubmitting) return
    if (!activeCompany) {
      setSubmitError("Selecciona una empresa activa antes de confirmar el asiento.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      const data = await apiFetch<{
        success: true
        entry: { id: string; fecha: string }
      }>("/api/accounting/entries", {
        method: "POST",
        body: JSON.stringify({
          fecha,
          commandCode: activeCommand,
          issueDate: showInvoicePanel ? invoiceDetails.issueDate : null,
          operationDate: showInvoicePanel ? invoiceDetails.operationDate : null,
          invoiceNumber: showInvoicePanel ? invoiceDetails.invoiceNumber : null,
          invoiceDetails: showInvoicePanel ? invoiceDetails : null,
          lines: lines.map(({ cuenta, concepto, debe, haber }) => ({
            cuenta,
            concepto,
            debe,
            haber,
          })),
        }),
      })

      setSubmitSuccess(`Asiento guardado correctamente (${data.entry.fecha}).`)
      resetForm()
      requestAnimationFrame(() => focusCell(0, "cuenta"))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo guardar el asiento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePgcSelect = (accountCode: string, accountName: string) => {
    const { row } = activeCell
    const line = lines[row]
    if (!line) return
    updateLine(line.id, { cuenta: accountCode, concepto: line.concepto || accountName })
    void applyAccountTreatment(accountCode, row)
    requestAnimationFrame(() => focusCell(row, "concepto"))
  }

  const handleCreateAccountPrefix = (prefix: NewAccountPrefix, row: number) => {
    setActiveCell({ row, field: "cuenta" })
    setNewSubaccountPrefix(prefix)
  }

  const handleSubaccountCreated = async (result: AccountCreationResult) => {
    if (result.kind === "third-party") {
      await loadThirdParties()
      applyAccountAssignment(
        {
          formattedAccountCode: result.resolution.formattedAccountCode,
          name: result.resolution.name,
          cif: result.resolution.cif,
          accountCode: result.resolution.accountCode,
        },
        activeCell.row,
      )
      return
    }

    await loadLedgerSubaccounts()
    applyAccountAssignment(
      {
        formattedAccountCode: result.resolution.formattedAccountCode,
        name: result.resolution.name,
        accountCode: result.resolution.accountCode,
      },
      activeCell.row,
    )
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-emerald-200">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-900 sm:text-xl">
            <Zap className="h-5 w-5 shrink-0" />
            Asiento rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {focusedThirdParty && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Tercero seleccionado: <strong>{focusedThirdParty}</strong>. Revisa la subcuenta y completa el
              asiento.
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="entry-fecha" className="text-xs font-medium text-graphite-600">
                Fecha asiento
              </label>
              <Input
                id="entry-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9 w-[148px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startManualEntry}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  !activeCommand
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                }`}
              >
                Asiento manual
              </button>
              {COMMAND_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => applyCommand(code)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    activeCommand === code
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                  }`}
                >
                  <span className="font-mono font-bold">{code}</span>{" "}
                  {ACCOUNTING_COMMANDS[code].label}
                </button>
              ))}
              <button
                type="button"
                onClick={openCompanyExtract}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-pine-900"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                EX extracto
              </button>
            </div>
          </div>

          {activeCommand && (
            <p className="text-sm text-emerald-700">
              {ACCOUNTING_COMMANDS[activeCommand].label} —{" "}
              {ACCOUNTING_COMMANDS[activeCommand].description}
            </p>
          )}
          {commandHint && (
            <p className="text-sm text-amber-700" role="alert">
              {commandHint}
            </p>
          )}
        </CardContent>
      </Card>

      {showInvoicePanel && (
        <InvoiceEntryPanel
          invoiceMode={invoiceMode}
          isManual={!isInvoiceCommand(activeCommand)}
          invoiceConceptPrefix={
            isInvoiceConceptCommand(activeCommand)
              ? INVOICE_CONCEPT_PREFIX[activeCommand]
              : null
          }
          details={invoiceDetails}
          onChange={setInvoiceDetails}
          onApplyTotals={applyInvoiceTotals}
          onOpenPgcChart={() => setPgcDialogOpen(true)}
          onOpenNifLookup={() => setNifDialogOpen(true)}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="w-28 px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="w-32 px-3 py-2 font-medium text-right">Debe</th>
                  <th className="w-32 px-3 py-2 font-medium text-right">Haber</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, rowIndex) => {
                  const warnings = validationByLine.get(line.id) ?? []
                  const hasWarning = warnings.length > 0
                  const invoiceConceptLocked =
                    isInvoiceConceptCommand(activeCommand) &&
                    isInvoiceConceptAccountLine(line.cuenta, activeCommand)

                  return (
                    <tr
                      key={line.id}
                      className={`border-b ${hasWarning ? "bg-amber-50/60" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="px-2 py-1">
                        <AccountCellInput
                          value={line.cuenta}
                          onChange={(value) => updateLine(line.id, { cuenta: value })}
                          onCreateAccountPrefix={(prefix) =>
                            handleCreateAccountPrefix(prefix, rowIndex)
                          }
                          onOpenAccountExtract={(accountCode) => openAccountExtract(rowIndex, accountCode)}
                          extractAccountCode={lastAccountByRow.current.get(rowIndex) ?? null}
                          onSelectSuggestion={(suggestion) => {
                            if (
                              (suggestion.source === "tercero" || suggestion.source === "ledger") &&
                              suggestion.subtitle
                            ) {
                              lastAccountByRow.current.set(rowIndex, suggestion.label)
                              updateLine(line.id, {
                                cuenta: suggestion.label,
                                concepto: suggestion.subtitle.split(" · ")[0] ?? line.concepto,
                              })
                              if (suggestion.source === "tercero") {
                                setFocusedThirdParty(suggestion.subtitle.split(" · ")[0] ?? null)
                                void applyAccountTreatment(suggestion.label, rowIndex)
                              }
                            }
                          }}
                          onFocus={() => setActiveCell({ row: rowIndex, field: "cuenta" })}
                          inputRef={(el) => registerRef(rowIndex, "cuenta", el)}
                          onKeyDown={(event) => handleCellKeyDown(event, rowIndex, "cuenta")}
                          thirdParties={thirdParties}
                          ledgerSubaccounts={ledgerSubaccounts}
                          hasWarning={hasWarning}
                          rowLabel={`Cuenta línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "concepto", el)}
                          value={line.concepto}
                          onChange={(e) => updateLine(line.id, { concepto: e.target.value })}
                          onFocus={() => setActiveCell({ row: rowIndex, field: "concepto" })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "concepto")}
                          readOnly={invoiceConceptLocked}
                          tabIndex={invoiceConceptLocked ? -1 : undefined}
                          className={cn(
                            "h-9",
                            invoiceConceptLocked && "bg-sand-50 text-graphite-600",
                          )}
                          placeholder="Descripción"
                          title={
                            invoiceConceptLocked
                              ? "Edita el número de factura en Datos de factura"
                              : undefined
                          }
                          aria-label={`Concepto línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "debe", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debe || ""}
                          onChange={(e) =>
                            updateLine(line.id, { debe: parseAmount(e.target.value) })
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "debe" })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "debe")}
                          className="h-9 text-right font-mono tabular-nums"
                          placeholder="0,00"
                          aria-label={`Debe línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "haber", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.haber || ""}
                          onChange={(e) =>
                            updateLine(line.id, { haber: parseAmount(e.target.value) })
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "haber" })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "haber")}
                          className="h-9 text-right font-mono tabular-nums"
                          placeholder="0,00"
                          aria-label={`Haber línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 1}
                          aria-label="Eliminar línea"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-right text-gray-600">
                    Totales
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.debe)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.haber)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {lineValidations.length > 0 && (
            <div className="space-y-2 border-t bg-amber-50 px-4 py-3">
              {lineValidations.map((v, i) => (
                <p key={`${v.lineId}-${i}`} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {v.message}
                </p>
              ))}
            </div>
          )}

          {(submitError || submitSuccess) && (
            <div
              className={`border-t px-4 py-3 text-sm ${
                submitError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
              }`}
              role="status"
            >
              {submitError ?? submitSuccess}
            </div>
          )}

          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${
              totals.isBalanced
                ? "bg-emerald-50"
                : totals.debe > 0 || totals.haber > 0
                  ? "bg-red-50"
                  : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {totals.isBalanced ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">Asiento cuadrado</span>
                </>
              ) : totals.debe > 0 || totals.haber > 0 ? (
                <>
                  <Scale className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    Descuadrado: diferencia {formatEuro(Math.abs(totals.difference))}{" "}
                    ({totals.difference > 0 ? "más Debe" : "más Haber"})
                  </span>
                </>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-4 w-4" />
                Línea
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={!totals.isBalanced || isSubmitting || !activeCompany}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Confirmar asiento"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PgcChartDialog
        open={pgcDialogOpen}
        onClose={() => setPgcDialogOpen(false)}
        onSelect={handlePgcSelect}
      />

      <NifAccountDialog
        open={nifDialogOpen}
        onClose={() => setNifDialogOpen(false)}
        thirdPartyType={
          invoiceMode === "emitida" ? "CLIENTE" : "PROVEEDOR"
        }
        onResolved={(resolution) =>
          applyAccountAssignment(
            {
              formattedAccountCode: resolution.formattedAccountCode,
              name: resolution.name,
              cif: resolution.cif,
              accountCode: resolution.accountCode,
            },
            activeCell.row,
          )
        }
      />

      <NewSubaccountDialog
        open={newSubaccountPrefix !== null}
        prefix={newSubaccountPrefix}
        onClose={() => setNewSubaccountPrefix(null)}
        onCreated={handleSubaccountCreated}
      />

      <AccountMovementsDialog
        open={movementsDialogOpen}
        cuenta={movementsAccount}
        year={Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()}
        refreshKey={movementsRefreshKey}
        onOpenEntry={(entryId) => setEditEntryId(entryId)}
        onEntryDeleted={() => setMovementsRefreshKey((value) => value + 1)}
        onClose={() => {
          setMovementsDialogOpen(false)
          setMovementsAccount(null)
        }}
      />

      <CompanyExtractDialog
        open={companyExtractOpen}
        year={Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()}
        onClose={() => setCompanyExtractOpen(false)}
        onSelectAccount={handleExtractAccountSelect}
      />

      <EditAccountingEntryDialog
        open={editEntryId !== null}
        entryId={editEntryId}
        onClose={() => setEditEntryId(null)}
        onSaved={() => setMovementsRefreshKey((value) => value + 1)}
        onDeleted={() => setMovementsRefreshKey((value) => value + 1)}
      />
    </div>
  )
}
