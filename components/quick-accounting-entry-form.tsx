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
  PieChart,
  Plus,
  Scale,
  Trash2,
  Zap,
} from "lucide-react"
import type { AccountingCommandCode, AccountingEntryLine, EntryCellField } from "@/lib/types/accounting-entry"
import {
  applyAmountToLineSide,
  getInvoiceAmountsFromDetails,
  getLineAmountSide,
  getLinePrefilledAmount,
  getNavigableFieldsForRow,
  getNextNavigableField,
  isAmountFieldDisabled,
  type EntryNavigationContext,
} from "@/lib/accounting/entry-line-navigation"
import type { AccountExistenceResult } from "@/lib/accounting/account-exists-service"
import {
  isAnalyticAccount,
  lineAnalyticAmount,
  type AnalyticDistributionInput,
} from "@/lib/accounting/analytic-accounting-types"
import { MissingAccountDialog } from "@/components/accounting/missing-account-dialog"
import { AnalyticDistributionDialog } from "@/components/accounting/analytic-distribution-dialog"
import {
  isThirdPartyAccountPrefix,
  parseNewAccountPrefix,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"
import {
  applyInvoiceConceptsToLines,
  INVOICE_CONCEPT_PREFIX,
  isInvoiceConceptAccountLine,
  isInvoiceConceptCommand,
} from "@/lib/accounting/invoice-entry-concepts"
import {
  ACCOUNTING_COMMANDS,
  calculateTotals,
  createEmptyLine,
  formatEuro,
  linesFromTemplate,
  parseCommandInput,
  validateEntryLines,
  getCommandEntryFocus,
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
  applyInvoiceAmountsToLines,
  applyTreatmentToEntryLines,
  applyTreatmentToInvoiceDetails,
  buildFullInvoiceEntry,
  calculateInvoiceAmountsWithIrpf,
  ensureMinimumInvoiceLines,
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
import { EntryRefSearchBar } from "@/components/accounting/entry-ref-search-bar"
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
    field: "fecha",
  })
  const [codigoDraft, setCodigoDraft] = useState("")
  const [pgcDialogOpen, setPgcDialogOpen] = useState(false)
  const [nifDialogOpen, setNifDialogOpen] = useState(false)
  const [newSubaccountPrefix, setNewSubaccountPrefix] = useState<NewAccountPrefix | null>(null)
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false)
  const [movementsAccount, setMovementsAccount] = useState<string | null>(null)
  const [companyExtractOpen, setCompanyExtractOpen] = useState(false)
  const [editEntryId, setEditEntryId] = useState<string | null>(null)
  const [movementsRefreshKey, setMovementsRefreshKey] = useState(0)
  const [analyticEnabled, setAnalyticEnabled] = useState(false)
  const [analyticByLineId, setAnalyticByLineId] = useState<Map<string, AnalyticDistributionInput[]>>(
    () => new Map(),
  )
  const [missingAccountState, setMissingAccountState] = useState<{
    row: number
    year: number
    account: AccountExistenceResult
  } | null>(null)
  const [fixedAccountCode, setFixedAccountCode] = useState<string | null>(null)
  const [analyticDialog, setAnalyticDialog] = useState<{ lineId: string; row: number } | null>(null)

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

  const navigationContext = useMemo(
    (): EntryNavigationContext => ({
      activeCommand,
      invoiceMode,
      invoiceDetails: showInvoicePanel ? invoiceDetails : null,
      lines,
    }),
    [activeCommand, invoiceMode, invoiceDetails, showInvoicePanel, lines],
  )

  const invoiceConceptOptions = useMemo(
    () => ({
      invoiceNumber: invoiceDetails.invoiceNumber,
      thirdPartyLabel: invoiceDetails.thirdPartyName || focusedThirdParty || "",
      invoiceMode,
    }),
    [focusedThirdParty, invoiceDetails.invoiceNumber, invoiceDetails.thirdPartyName, invoiceMode],
  )

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

  const syncInvoiceAmountsToLines = useCallback(
    (sourceLines: AccountingEntryLine[]) => {
      const amounts =
        getInvoiceAmountsFromDetails(invoiceDetails) ??
        calculateInvoiceAmountsWithIrpf(invoiceDetails)
      if (amounts.base <= 0 && amounts.quota <= 0 && amounts.total <= 0) {
        return sourceLines
      }

      let next = ensureMinimumInvoiceLines(sourceLines)
      next = applyInvoiceAmountsToLines(next, amounts, {
        activeCommand: activeCommand ?? undefined,
      })

      if (isInvoiceConceptCommand(activeCommand)) {
        next = applyInvoiceConceptsToLines(next, activeCommand, invoiceConceptOptions)
      }

      return next
    },
    [activeCommand, invoiceConceptOptions, invoiceDetails],
  )

  const prefillLineAmount = useCallback(
    (row: number, sourceLines = lines) => {
      const line = sourceLines[row]
      if (!line) return

      const ctx: EntryNavigationContext = {
        ...navigationContext,
        lines: sourceLines,
      }
      const side = getLineAmountSide(row, line, ctx)
      const amount = getLinePrefilledAmount(row, ctx)
      if (!side || amount <= 0) return

      setLines((prev) =>
        prev.map((item) =>
          item.id === line.id ? applyAmountToLineSide(item, side, amount) : item,
        ),
      )
    },
    [lines, navigationContext],
  )

  const focusNextCell = useCallback(
    (row: number, field: EntryCellField) => {
      const next = getNextNavigableField(row, field, navigationContext)
      if (next) {
        if (next.field === "debe" || next.field === "haber") {
          prefillLineAmount(next.row)
        }
        focusCell(next.row, next.field)
        return
      }

      setLines((prev) => [...prev, createEmptyLine()])
      requestAnimationFrame(() => focusCell(row + 1, "concepto"))
    },
    [focusCell, navigationContext, prefillLineAmount],
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
      requestAnimationFrame(() => {
        const line = lines[targetRow]
        if (!line) {
          focusCell(targetRow, "debe")
          return
        }
        const side = getLineAmountSide(targetRow, line, navigationContext) ?? "debe"
        prefillLineAmount(targetRow)
        focusCell(targetRow, side)
      })
    },
    [applyAccountTreatment, focusCell, lines, navigationContext, prefillLineAmount],
  )

  const applyInvoiceTotalsAndFocus = useCallback(
    (amounts?: { base: number; quota: number; total: number; irpf?: number }) => {
      const resolved = amounts ?? calculateInvoiceAmountsWithIrpf(invoiceDetails)
      setLines((prev) => {
        let next = ensureMinimumInvoiceLines(prev)
        next = applyInvoiceAmountsToLines(
          next,
          {
            base: resolved.base,
            quota: resolved.quota,
            irpf: resolved.irpf ?? 0,
            total: resolved.total,
          },
          { activeCommand: activeCommand ?? undefined },
        )

        if (isInvoiceConceptCommand(activeCommand)) {
          next = applyInvoiceConceptsToLines(next, activeCommand, invoiceConceptOptions)
        }

        requestAnimationFrame(() => {
          const ctx: EntryNavigationContext = {
            activeCommand,
            invoiceMode,
            invoiceDetails,
            lines: next,
          }
          const firstLine = next[0]
          const side = firstLine ? getLineAmountSide(0, firstLine, ctx) ?? "debe" : "debe"
          focusCell(0, side)
        })

        return next
      })
    },
    [activeCommand, focusCell, invoiceConceptOptions, invoiceDetails, invoiceMode],
  )

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

      requestAnimationFrame(() => {
        const focus = getCommandEntryFocus(code)
        focusCell(focus.row, focus.field)
      })
    },
    [fecha, focusCell],
  )

  useEffect(() => {
    requestAnimationFrame(() => focusCell(0, "fecha"))
  }, [focusCell])

  useEffect(() => {
    loadThirdParties()
    loadLedgerSubaccounts()
  }, [loadLedgerSubaccounts, loadThirdParties])

  useEffect(() => {
    if (!activeCompany?.id) {
      setAnalyticEnabled(false)
      return
    }
    apiFetch<{ success: true; settings: { analyticAccountingEnabled: boolean } }>(
      "/api/accounting/analytic-settings",
    )
      .then((data) => setAnalyticEnabled(data.settings.analyticAccountingEnabled))
      .catch(() => setAnalyticEnabled(false))
  }, [activeCompany?.id])

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
      if (code) {
        setCodigoDraft(comando.trim())
        applyCommand(code)
      }
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
    setLines((prev) => {
      let next = applyInvoiceConceptsToLines(prev, activeCommand, invoiceConceptOptions)
      const doc = invoiceDetails.invoiceNumber.trim()
      if (doc) {
        next = next.map((line) => ({ ...line, documento: doc }))
      }
      return next
    })
  }, [activeCommand, invoiceConceptOptions, invoiceDetails.invoiceNumber])

  useEffect(() => {
    setInvoiceDetails((prev) => ({
      ...prev,
      issueDate: fecha,
      operationDate: fecha,
    }))
  }, [fecha])

  const applyCodigoFromRow = useCallback(
    async (row: number, raw: string): Promise<boolean> => {
      if (row !== 0) return false
      const trimmed = raw.trim()
      if (!trimmed) {
        setActiveCommand(null)
        setCommandHint(null)
        setCodigoDraft("")
        return false
      }
      const code = parseCommandInput(trimmed)
      if (!code) {
        setCommandHint(`Código "${trimmed}" no reconocido. Use 17, 34, 16, 57 o 303, o deje vacío para apunte manual.`)
        return false
      }
      setCodigoDraft(trimmed)
      await applyCommand(code)
      return true
    },
    [applyCommand],
  )

  const validateAccountBeforeAdvance = useCallback(
    async (row: number): Promise<boolean> => {
      const line = lines[row]
      if (!line || !isValidAccountValue(line.cuenta) || parseNewAccountPrefix(line.cuenta)) {
        return true
      }

      const year = Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()
      try {
        const data = await apiFetch<{ success: true; year: number } & AccountExistenceResult>(
          `/api/accounting/accounts/exists?code=${encodeURIComponent(line.cuenta)}&year=${year}`,
        )
        if (data.exists) return true
        setMissingAccountState({ row, year: data.year, account: data })
        return false
      } catch {
        return true
      }
    },
    [fecha, lines],
  )

  const maybePromptAnalytic = useCallback(
    async (row: number): Promise<boolean> => {
      if (!analyticEnabled) return true
      const line = lines[row]
      if (!line || !isAnalyticAccount(line.cuenta)) return true

      const amount = lineAnalyticAmount(line.debe, line.haber)
      if (amount <= 0) return true

      const existing = analyticByLineId.get(line.id)
      if (existing?.length) {
        const assigned = existing.reduce((sum, item) => sum + item.amount, 0)
        if (Math.abs(assigned - amount) < 0.02) return true
      }

      setAnalyticDialog({ lineId: line.id, row })
      return false
    },
    [analyticByLineId, analyticEnabled, lines],
  )

  const handleCellKeyDown = async (
    event: KeyboardEvent<HTMLInputElement>,
    row: number,
    field: EntryCellField,
  ) => {
    if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault()

      if (field === "codigo") {
        const applied = await applyCodigoFromRow(row, codigoDraft)
        if (!applied) {
          focusNextCell(row, field)
        }
        return
      }

      if (field === "cuenta") {
        const ok = await validateAccountBeforeAdvance(row)
        if (!ok) return

        if (showInvoicePanel) {
          setLines((prev) => {
            const synced = syncInvoiceAmountsToLines(prev)
            requestAnimationFrame(() => {
              const next = getNextNavigableField(row, field, {
                ...navigationContext,
                lines: synced,
              })
              if (next) {
                focusCell(next.row, next.field)
              } else {
                focusNextCell(row, field)
              }
            })
            return synced
          })
        } else {
          prefillLineAmount(row)
          requestAnimationFrame(() => focusNextCell(row, field))
        }
        return
      }

      if (field === "debe" || field === "haber") {
        const canAdvance = await maybePromptAnalytic(row)
        if (!canAdvance) return
      }

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

  const handleLineAmountChange = useCallback(
    (rowIndex: number, line: AccountingEntryLine, field: "debe" | "haber", amount: number) => {
      const patch =
        field === "debe" ? { debe: amount, haber: 0 } : { haber: amount, debe: 0 }

      const isThirdPartyTotal =
        isThirdPartyAccountPrefix(line.cuenta) &&
        ((invoiceMode === "emitida" && field === "debe") ||
          (invoiceMode === "recibida" && field === "haber"))

      if (
        amount > 0 &&
        isThirdPartyTotal &&
        (showInvoicePanel || isInvoiceCommand(activeCommand))
      ) {
        setLines((prev) => {
          const withAmount = prev.map((item) =>
            item.id === line.id ? { ...item, ...patch } : item,
          )
          const built = buildFullInvoiceEntry(withAmount, invoiceDetails, {
            activeCommand,
            invoiceMode,
            total: amount,
          })
          setInvoiceDetails(built.details)
          return built.lines
        })
        return
      }

      updateLine(line.id, patch)
    },
    [activeCommand, invoiceDetails, invoiceMode, showInvoicePanel],
  )

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
    requestAnimationFrame(() => focusCell(lines.length, "concepto"))
  }

  const resetForm = useCallback(() => {
    setActiveCommand(null)
    setCodigoDraft("")
    setFecha(new Date().toISOString().split("T")[0])
    setLines([createEmptyLine()])
    setInvoiceDetails(createDefaultInvoiceDetails(new Date().toISOString().split("T")[0]))
    setCommandHint(null)
    setSubmitError(null)
    setFocusedThirdParty(null)
    setAnalyticByLineId(new Map())
  }, [])

  const getDocumentoValue = useCallback(
    (rowIndex: number, line: AccountingEntryLine): string => {
      if (rowIndex === 0 && isInvoiceConceptCommand(activeCommand)) {
        return invoiceDetails.invoiceNumber
      }
      return line.documento ?? ""
    },
    [activeCommand, invoiceDetails.invoiceNumber],
  )

  const handleDocumentoChange = useCallback(
    (rowIndex: number, lineId: string, value: string) => {
      if (rowIndex === 0 && isInvoiceConceptCommand(activeCommand)) {
        setInvoiceDetails((prev) => ({ ...prev, invoiceNumber: value }))
      } else {
        updateLine(lineId, { documento: value })
      }
    },
    [activeCommand],
  )

  const entryStatusHint = useMemo((): string => {
    if (activeCell.field === "codigo") {
      return "Indique el Código de Predefinido o Pulse F4"
    }
    if (activeCell.field === "cuenta") {
      return "F4 · Plan contable · F6 · Buscar NIF · EX · extracto de cuenta"
    }
    if (activeCommand) {
      return `${ACCOUNTING_COMMANDS[activeCommand].label} — ${ACCOUNTING_COMMANDS[activeCommand].description}`
    }
    return "Apunte manual — Tab para avanzar entre campos"
  }, [activeCell.field, activeCommand])

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
        entry: { id: string; refNumber: number; fecha: string }
      }>("/api/accounting/entries", {
        method: "POST",
        body: JSON.stringify({
          fecha,
          commandCode: activeCommand,
          issueDate: showInvoicePanel ? invoiceDetails.issueDate : null,
          operationDate: showInvoicePanel ? invoiceDetails.operationDate : null,
          invoiceNumber: showInvoicePanel ? invoiceDetails.invoiceNumber : null,
          invoiceDetails: showInvoicePanel ? invoiceDetails : null,
          lines: lines.map(({ id, cuenta, concepto, debe, haber }) => ({
            cuenta,
            concepto,
            debe,
            haber,
            analyticDistributions: analyticByLineId.get(id),
          })),
        }),
      })

      setSubmitSuccess(`Asiento ${data.entry.refNumber} guardado correctamente (${data.entry.fecha}).`)
      setMovementsRefreshKey((value) => value + 1)
      resetForm()
      requestAnimationFrame(() => focusCell(0, "fecha"))
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
    requestAnimationFrame(() => {
      const side = getLineAmountSide(row, { ...line, cuenta: accountCode }, navigationContext) ?? "debe"
      prefillLineAmount(row)
      focusCell(row, side)
    })
  }

  const handleCreateAccountPrefix = (prefix: NewAccountPrefix, row: number) => {
    setActiveCell({ row, field: "cuenta" })
    setFixedAccountCode(null)
    setNewSubaccountPrefix(prefix)
  }

  const handleMissingAccountConfirm = () => {
    if (!missingAccountState?.account.parentCode) return
    setActiveCell({ row: missingAccountState.row, field: "cuenta" })
    setFixedAccountCode(missingAccountState.account.accountCode)
    setNewSubaccountPrefix(missingAccountState.account.parentCode)
    setMissingAccountState(null)
  }

  const handleMissingAccountCancel = () => {
    if (!missingAccountState) return
    const { row } = missingAccountState
    setMissingAccountState(null)
    requestAnimationFrame(() => focusCell(row, "cuenta"))
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
          <EntryRefSearchBar
            refreshKey={movementsRefreshKey}
            onOpenEntry={(entryId) => setEditEntryId(entryId)}
          />

          {focusedThirdParty && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Tercero seleccionado: <strong>{focusedThirdParty}</strong>. Revisa la subcuenta y completa el
              asiento.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-graphite-500">
              Tab entre campos · F4 plan contable · F6 NIF · F8 extracto cuenta
            </p>
            <button
              type="button"
              onClick={openCompanyExtract}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-pine-900"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              EX extracto
            </button>
          </div>

          {activeCommand && (
            <p className="text-sm text-emerald-700">
              Código <span className="font-mono font-bold">{activeCommand}</span> —{" "}
              {ACCOUNTING_COMMANDS[activeCommand].label}
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
          onApplyTotals={applyInvoiceTotalsAndFocus}
          onOpenPgcChart={() => setPgcDialogOpen(true)}
          onOpenNifLookup={() => setNifDialogOpen(true)}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="w-[108px] px-2 py-2 font-medium">Fecha</th>
                  <th className="w-14 px-2 py-2 font-medium">Cód.</th>
                  <th className="min-w-[140px] px-2 py-2 font-medium">Concepto</th>
                  <th className="w-24 px-2 py-2 font-medium">Documen.</th>
                  <th className="w-28 px-2 py-2 font-medium">Cuenta</th>
                  <th className="w-28 px-2 py-2 font-medium text-right">Debe</th>
                  <th className="w-28 px-2 py-2 font-medium text-right">Haber</th>
                  <th className="w-28 px-2 py-2 font-medium">Contrapartida</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, rowIndex) => {
                  const warnings = validationByLine.get(line.id) ?? []
                  const hasWarning = warnings.length > 0
                  const isActiveRow = activeCell.row === rowIndex
                  const invoiceConceptLocked =
                    isInvoiceConceptCommand(activeCommand) &&
                    isInvoiceConceptAccountLine(line.cuenta, activeCommand)
                  const rowContext: EntryNavigationContext = {
                    ...navigationContext,
                    lines,
                  }
                  const debeDisabled = isAmountFieldDisabled(rowIndex, line, "debe", rowContext)
                  const haberDisabled = isAmountFieldDisabled(rowIndex, line, "haber", rowContext)
                  const conceptSkippable =
                    getNavigableFieldsForRow(rowIndex, line, rowContext).includes("concepto") ===
                    false && Boolean(line.concepto)

                  return (
                    <tr
                      key={line.id}
                      className={cn(
                        "border-b",
                        isActiveRow && "bg-emerald-100/70",
                        !isActiveRow && hasWarning && "bg-amber-50/60",
                        !isActiveRow && !hasWarning && "hover:bg-gray-50/50",
                      )}
                    >
                      <td className="px-1 py-1">
                        {rowIndex === 0 ? (
                          <Input
                            ref={(el) => registerRef(rowIndex, "fecha", el)}
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            onFocus={() => setActiveCell({ row: rowIndex, field: "fecha" })}
                            onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "fecha")}
                            className="h-9 px-2 text-xs"
                            aria-label="Fecha contable"
                          />
                        ) : null}
                      </td>
                      <td className="px-1 py-1">
                        {rowIndex === 0 ? (
                          <Input
                            ref={(el) => registerRef(rowIndex, "codigo", el)}
                            value={codigoDraft}
                            onChange={(e) => setCodigoDraft(e.target.value)}
                            onFocus={() => setActiveCell({ row: rowIndex, field: "codigo" })}
                            onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "codigo")}
                            className="h-9 px-2 text-center font-mono font-semibold"
                            placeholder="—"
                            maxLength={3}
                            aria-label="Código predefinido"
                          />
                        ) : null}
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "concepto", el)}
                          value={line.concepto}
                          onChange={(e) => updateLine(line.id, { concepto: e.target.value })}
                          onFocus={() => setActiveCell({ row: rowIndex, field: "concepto" })}
                          onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "concepto")}
                          readOnly={invoiceConceptLocked || conceptSkippable}
                          tabIndex={invoiceConceptLocked || conceptSkippable ? -1 : undefined}
                          className={cn(
                            "h-9",
                            (invoiceConceptLocked || conceptSkippable) &&
                              "bg-sand-50 text-graphite-600",
                          )}
                          placeholder="Descripción"
                          title={
                            invoiceConceptLocked
                              ? "Edita el número en Documen. o Datos de factura"
                              : undefined
                          }
                          aria-label={`Concepto línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "documento", el)}
                          value={getDocumentoValue(rowIndex, line)}
                          onChange={(e) =>
                            handleDocumentoChange(rowIndex, line.id, e.target.value)
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "documento" })}
                          onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "documento")}
                          className="h-9 px-2 font-mono text-xs"
                          placeholder="N.º"
                          aria-label={`Documento línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <AccountCellInput
                          value={line.cuenta}
                          onChange={(value) => updateLine(line.id, { cuenta: value })}
                          onCreateAccountPrefix={(prefix) =>
                            handleCreateAccountPrefix(prefix, rowIndex)
                          }
                          onOpenAccountExtract={(accountCode) =>
                            openAccountExtract(rowIndex, accountCode)
                          }
                          extractAccountCode={lastAccountByRow.current.get(rowIndex) ?? null}
                          onFocus={() => setActiveCell({ row: rowIndex, field: "cuenta" })}
                          inputRef={(el) => registerRef(rowIndex, "cuenta", el)}
                          onBeforeAdvance={() => validateAccountBeforeAdvance(rowIndex)}
                          onBlur={() => {
                            void validateAccountBeforeAdvance(rowIndex)
                          }}
                          onKeyDown={(event) => void handleCellKeyDown(event, rowIndex, "cuenta")}
                          hasWarning={hasWarning}
                          rowLabel={`Cuenta línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "debe", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debe || ""}
                          onChange={(e) =>
                            handleLineAmountChange(
                              rowIndex,
                              line,
                              "debe",
                              parseAmount(e.target.value),
                            )
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "debe" })}
                          onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "debe")}
                          readOnly={debeDisabled}
                          tabIndex={debeDisabled ? -1 : undefined}
                          className={cn(
                            "h-9 text-right font-mono tabular-nums",
                            debeDisabled && "cursor-default bg-gray-100 text-gray-400",
                          )}
                          placeholder="0,00"
                          aria-label={`Debe línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "haber", el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.haber || ""}
                          onChange={(e) =>
                            handleLineAmountChange(
                              rowIndex,
                              line,
                              "haber",
                              parseAmount(e.target.value),
                            )
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "haber" })}
                          onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "haber")}
                          readOnly={haberDisabled}
                          tabIndex={haberDisabled ? -1 : undefined}
                          className={cn(
                            "h-9 text-right font-mono tabular-nums",
                            haberDisabled && "cursor-default bg-gray-100 text-gray-400",
                          )}
                          placeholder="0,00"
                          aria-label={`Haber línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          ref={(el) => registerRef(rowIndex, "contrapartida", el)}
                          value={line.contrapartida ?? ""}
                          onChange={(e) =>
                            updateLine(line.id, { contrapartida: e.target.value })
                          }
                          onFocus={() => setActiveCell({ row: rowIndex, field: "contrapartida" })}
                          onKeyDown={(e) => void handleCellKeyDown(e, rowIndex, "contrapartida")}
                          className="h-9 px-2 font-mono text-xs"
                          placeholder="430…"
                          aria-label={`Contrapartida línea ${rowIndex + 1}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center gap-0.5">
                          {analyticEnabled && isAnalyticAccount(line.cuenta) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 w-8 p-0",
                                analyticByLineId.has(line.id) && "text-emerald-700",
                              )}
                              onClick={() => setAnalyticDialog({ lineId: line.id, row: rowIndex })}
                              title="Distribución analítica"
                              aria-label="Distribución analítica"
                            >
                              <PieChart className="h-4 w-4" />
                            </Button>
                          )}
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
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right text-gray-600">
                    Totales
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.debe)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatEuro(totals.haber)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t bg-emerald-50/80 px-4 py-2 text-xs text-emerald-900">
            {entryStatusHint}
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
        fixedAccountCode={fixedAccountCode}
        onClose={() => {
          setNewSubaccountPrefix(null)
          setFixedAccountCode(null)
        }}
        onCreated={handleSubaccountCreated}
      />

      <MissingAccountDialog
        open={missingAccountState !== null}
        year={missingAccountState?.year ?? new Date().getFullYear()}
        account={missingAccountState?.account ?? null}
        onConfirm={handleMissingAccountConfirm}
        onCancel={handleMissingAccountCancel}
      />

      {analyticDialog && (() => {
        const line = lines.find((item) => item.id === analyticDialog.lineId)
        if (!line) return null
        const amount = lineAnalyticAmount(line.debe, line.haber)
        return (
          <AnalyticDistributionDialog
            open
            accountCode={line.cuenta}
            concepto={line.concepto}
            totalAmount={amount}
            initialDistributions={analyticByLineId.get(line.id)}
            onClose={() => setAnalyticDialog(null)}
            onSave={(distributions) => {
              setAnalyticByLineId((prev) => {
                const next = new Map(prev)
                next.set(line.id, distributions)
                return next
              })
              setAnalyticDialog(null)
              requestAnimationFrame(() => focusCell(analyticDialog.row, "haber"))
            }}
          />
        )
      })()}

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
