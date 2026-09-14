"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { InvoiceEntryPanel } from "@/components/accounting/invoice-entry-panel"
import { MissingAccountDialog } from "@/components/accounting/missing-account-dialog"
import {
  NewSubaccountDialog,
  type AccountCreationResult,
} from "@/components/accounting/new-subaccount-dialog"
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
import {
  isThirdPartyAccountPrefix,
  parseNewAccountPrefix,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"
import {
  applyInvoiceConceptsToLines,
  INVOICE_CONCEPT_PREFIX,
} from "@/lib/accounting/invoice-entry-concepts"
import {
  parseDottedAccountShortcut,
  resolveAccountShortcut,
  toShortcutCandidates,
} from "@/lib/accounting/account-shortcut"
import type { AccountExistenceResult } from "@/lib/accounting/account-exists-service"
import type { ThirdPartyAccountOption } from "@/lib/accounting/account-suggestions"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import type { AccountTreatmentConfigDto } from "@/lib/accounting/account-treatment-types"
import {
  applyTreatmentToEntryLines,
  applyTreatmentToInvoiceDetails,
  buildFullInvoiceEntry,
  getInvoiceThirdPartyTotal,
  isDerivedInvoiceAmountAccount,
  isInvoiceThirdPartyTotalAmount,
} from "@/lib/accounting/invoice-auto-fill"
import type { AccountingCommandCode } from "@/lib/types/accounting-entry"
import { cn } from "@/lib/utils"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { formatEntryRefLabel } from "@/lib/accounting/entry-ref-service"

function resolveInvoiceMode(
  commandCode: string | null | undefined,
  lines: AccountingEntryLine[],
): "emitida" | "recibida" {
  if (commandCode === "34") return "recibida"
  if (commandCode === "17") return "emitida"
  if (lines.some((line) => isEmitidaThirdPartyAccount(line.cuenta))) return "emitida"
  return "recibida"
}

function rebuildInvoiceFromTotal(
  lines: AccountingEntryLine[],
  details: InvoiceEntryDetails,
  commandCode: string | null | undefined,
  total: number,
) {
  const invoiceMode = resolveInvoiceMode(commandCode, lines)
  return buildFullInvoiceEntry(lines, details, {
    activeCommand: (commandCode as AccountingCommandCode | null) ?? null,
    invoiceMode,
    total,
  })
}

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
  const [thirdParties, setThirdParties] = useState<ThirdPartyAccountOption[]>([])
  const [ledgerSubaccounts, setLedgerSubaccounts] = useState<LedgerSubaccountOption[]>([])
  const [missingAccount, setMissingAccount] = useState<AccountExistenceResult | null>(null)
  const [pendingLineId, setPendingLineId] = useState<string | null>(null)
  const [newSubaccountPrefix, setNewSubaccountPrefix] = useState<NewAccountPrefix | null>(null)
  const [fixedAccountCode, setFixedAccountCode] = useState<string | null>(null)
  const lastCommittedCuenta = useRef(new Map<string, string>())
  const pendingLineIdRef = useRef<string | null>(null)
  const createdAccountRef = useRef(false)

  const totals = useMemo(() => calculateTotals(lines), [lines])
  const lineValidations = useMemo(() => validateEntryLines(lines), [lines])

  const invoiceMode = useMemo(
    () => resolveInvoiceMode(entry?.commandCode, lines),
    [entry?.commandCode, lines],
  )

  const showInvoicePanel = useMemo(() => {
    if (!entry) return false
    return hasInvoiceData(entry) || lines.some((line) => isThirdPartyAccountPrefix(line.cuenta))
  }, [entry, lines])

  useEffect(() => {
    if (!open || !entryId) {
      setEntry(null)
      setError(null)
      setMissingAccount(null)
      setNewSubaccountPrefix(null)
      setFixedAccountCode(null)
      setPendingLineId(null)
      pendingLineIdRef.current = null
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
        const mapped = mapEntryLines(data.entry)
        lastCommittedCuenta.current = new Map(mapped.map((line) => [line.id, line.cuenta]))
        const details = getEditableInvoiceDetails(data.entry)
        const mode = resolveInvoiceMode(data.entry.commandCode, mapped)
        const total = getInvoiceThirdPartyTotal(mapped, mode)
        if (details && total > 0) {
          const built = rebuildInvoiceFromTotal(mapped, details, data.entry.commandCode, total)
          const savedConcepts = new Map(mapped.map((line) => [line.id, line.concepto]))
          setLines(
            built.lines.map((line) => ({
              ...line,
              concepto: savedConcepts.get(line.id) ?? line.concepto,
            })),
          )
          setInvoiceDetails(built.details)
        } else {
          setLines(mapped)
          setInvoiceDetails(details)
        }
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

  const loadCatalogs = useCallback(async () => {
    try {
      const [parties, ledger] = await Promise.all([
        apiFetch<{ success: true; thirdParties: ThirdPartyAccountOption[] }>("/api/accounting/third-parties"),
        apiFetch<{ success: true; subaccounts: LedgerSubaccountOption[] }>(
          "/api/accounting/ledger-subaccounts",
        ),
      ])
      setThirdParties(parties.thirdParties)
      setLedgerSubaccounts(ledger.subaccounts)
    } catch {
      setThirdParties([])
      setLedgerSubaccounts([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadCatalogs()
  }, [open, loadCatalogs])

  const updateLine = (lineId: string, patch: Partial<AccountingEntryLine>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)))
  }

  const shortcutCandidates = useMemo(
    () => toShortcutCandidates(thirdParties, ledgerSubaccounts),
    [ledgerSubaccounts, thirdParties],
  )

  const applyPartyToInvoice = useCallback(
    (
      nextLines: AccountingEntryLine[],
      partyName: string,
      commandCode: string | null | undefined,
      partyCif?: string,
    ) => {
      const command = commandCode === "17" || commandCode === "34" ? commandCode : null
      if (!partyName || !command) return nextLines
      return applyInvoiceConceptsToLines(nextLines, command, {
        invoiceNumber: invoiceDetails?.invoiceNumber ?? "",
        thirdPartyLabel: partyName,
        invoiceMode,
        nif: partyCif || invoiceDetails?.nif,
      })
    },
    [invoiceDetails?.invoiceNumber, invoiceDetails?.nif, invoiceMode],
  )

  const lookupExactParty = useCallback(
    (rawCuenta: string) => {
      const digits = rawCuenta.replace(/\D/g, "")
      if (!digits) return null
      const party = thirdParties.find((item) => item.accountCode.replace(/\D/g, "") === digits)
      if (party) {
        return {
          accountCode: party.accountCode.replace(/\D/g, ""),
          formattedAccountCode: formatAccountCodeDisplay(party.accountCode),
          name: party.name,
          cif: party.cif,
          source: "tercero" as const,
        }
      }
      const ledger = ledgerSubaccounts.find((item) => item.accountCode.replace(/\D/g, "") === digits)
      if (!ledger) return null
      return {
        accountCode: ledger.accountCode.replace(/\D/g, ""),
        formattedAccountCode: formatAccountCodeDisplay(ledger.accountCode),
        name: ledger.name,
        cif: undefined,
        source: "ledger" as const,
      }
    },
    [ledgerSubaccounts, thirdParties],
  )

  const lookupPartyForAccount = useCallback(
    (rawCuenta: string) => {
      return resolveAccountShortcut(rawCuenta, shortcutCandidates) ?? lookupExactParty(rawCuenta)
    },
    [lookupExactParty, shortcutCandidates],
  )

  const thirdPartyCuenta = lines.find((line) => isThirdPartyAccountPrefix(line.cuenta))?.cuenta

  useEffect(() => {
    if (!open || !entry || !thirdPartyCuenta) return
    if (invoiceDetails?.thirdPartyName.trim()) return

    const party = lookupExactParty(thirdPartyCuenta)
    if (!party?.name || party.source !== "tercero") return

    setInvoiceDetails((prev) =>
      prev
        ? {
            ...prev,
            nif: party.cif || prev.nif,
            thirdPartyName: party.name,
          }
        : prev,
    )
    setLines((prev) => applyPartyToInvoice(prev, party.name, entry.commandCode, party.cif))
  }, [
    applyPartyToInvoice,
    entry,
    invoiceDetails?.thirdPartyName,
    lookupExactParty,
    open,
    thirdPartyCuenta,
  ])

  const applyResolvedAccount = async (
    lineId: string,
    resolvedCode: string,
    partyName?: string,
    partyCif?: string,
  ) => {
    lastCommittedCuenta.current.set(lineId, resolvedCode)
    const applyParty = Boolean(partyName && isThirdPartyAccountPrefix(resolvedCode))

    setLines((prev) => {
      const withAccount = prev.map((item) =>
        item.id === lineId ? { ...item, cuenta: resolvedCode } : item,
      )
      return applyParty ? applyPartyToInvoice(withAccount, partyName ?? "", entry?.commandCode, partyCif) : withAccount
    })

    if (applyParty && partyName) {
      setInvoiceDetails((prev) =>
        prev
          ? {
              ...prev,
              nif: partyCif || prev.nif,
              thirdPartyName: partyName,
            }
          : prev,
      )
    }

    if (!isThirdPartyAccountPrefix(resolvedCode)) return

    try {
      const data = await apiFetch<{ success: true; treatment: AccountTreatmentConfigDto | null }>(
        `/api/accounting/account-treatment?accountCode=${encodeURIComponent(resolvedCode)}`,
      )
      if (!data.treatment) return

      setInvoiceDetails((prev) => (prev ? applyTreatmentToInvoiceDetails(prev, data.treatment!) : prev))
      setLines((prev) => {
        const treated = applyTreatmentToEntryLines(prev, data.treatment!, {
          activeCommand: entry?.commandCode,
          thirdPartyLabel: partyName,
        })
        return applyPartyToInvoice(treated, partyName ?? "", entry?.commandCode, partyCif)
      })
    } catch {
      // Sin parametrización: se mantienen las líneas actuales
    }
  }

  const restorePendingLine = () => {
    const lineId = pendingLineIdRef.current
    if (!lineId) return
    const previous = lastCommittedCuenta.current.get(lineId) ?? ""
    setLines((prev) => prev.map((item) => (item.id === lineId ? { ...item, cuenta: previous } : item)))
    pendingLineIdRef.current = null
    setPendingLineId(null)
  }

  const promptMissingAccount = (lineId: string, account: AccountExistenceResult) => {
    pendingLineIdRef.current = lineId
    setPendingLineId(lineId)
    setMissingAccount(account)
  }

  const commitAccountLine = async (line: AccountingEntryLine, rawCuenta: string) => {
    const trimmed = rawCuenta.trim()
    if (!trimmed) {
      lastCommittedCuenta.current.set(line.id, "")
      updateLine(line.id, { cuenta: "" })
      return
    }

    const createPrefix = parseNewAccountPrefix(trimmed)
    if (createPrefix) {
      pendingLineIdRef.current = line.id
      setPendingLineId(line.id)
      createdAccountRef.current = false
      setFixedAccountCode(null)
      setNewSubaccountPrefix(createPrefix)
      return
    }

    const shortcut = lookupPartyForAccount(trimmed)
    if (shortcut) {
      await applyResolvedAccount(line.id, shortcut.formattedAccountCode, shortcut.name, shortcut.cif)
      return
    }

    try {
      const year = Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()
      const data = await apiFetch<{ success: true; year: number } & AccountExistenceResult>(
        `/api/accounting/accounts/exists?code=${encodeURIComponent(trimmed)}&year=${year}`,
      )

      if (!data.exists) {
        promptMissingAccount(line.id, data)
        return
      }

      const resolvedCode = data.formattedAccountCode || trimmed
      const partyName =
        data.label && isThirdPartyAccountPrefix(data.accountCode) ? data.label : undefined
      await applyResolvedAccount(line.id, resolvedCode, partyName)
    } catch {
      lastCommittedCuenta.current.set(line.id, trimmed)
      updateLine(line.id, { cuenta: trimmed })
    }
  }

  const handleMissingAccountConfirm = () => {
    if (!missingAccount?.parentCode) return
    createdAccountRef.current = false
    setFixedAccountCode(missingAccount.accountCode)
    setNewSubaccountPrefix(missingAccount.parentCode)
    setMissingAccount(null)
  }

  const handleMissingAccountCancel = () => {
    setMissingAccount(null)
    restorePendingLine()
  }

  const handleSubaccountCreated = async (result: AccountCreationResult) => {
    const lineId = pendingLineIdRef.current
    createdAccountRef.current = true
    if (!lineId) return

    const formatted = result.resolution.formattedAccountCode
    const name = result.resolution.name
    const cif = result.kind === "third-party" ? result.resolution.cif : undefined
    await applyResolvedAccount(lineId, formatted, name, cif)
    await loadCatalogs()
    pendingLineIdRef.current = null
    setPendingLineId(null)
  }

  const handleCreateAccountClose = () => {
    if (!createdAccountRef.current) {
      restorePendingLine()
    }
    createdAccountRef.current = false
    setNewSubaccountPrefix(null)
    setFixedAccountCode(null)
    pendingLineIdRef.current = null
    setPendingLineId(null)
  }

  const handleLineAmountChange = (
    line: AccountingEntryLine,
    field: "debe" | "haber",
    amount: number,
  ) => {
    if (invoiceDetails && isInvoiceThirdPartyTotalAmount(line, field, invoiceMode) && amount > 0) {
      const nextLines = lines.map((item) =>
        item.id === line.id
          ? field === "debe"
            ? { ...item, debe: amount, haber: 0 }
            : { ...item, haber: amount, debe: 0 }
          : item,
      )
      const built = rebuildInvoiceFromTotal(nextLines, invoiceDetails, entry?.commandCode, amount)
      setLines(built.lines)
      setInvoiceDetails(built.details)
      return
    }

    updateLine(line.id, field === "debe" ? { debe: amount, haber: 0 } : { haber: amount, debe: 0 })
  }

  const handleInvoiceDetailsChange = (nextDetails: InvoiceEntryDetails) => {
    const total = getInvoiceThirdPartyTotal(lines, invoiceMode)
    if (total > 0) {
      const built = rebuildInvoiceFromTotal(lines, nextDetails, entry?.commandCode, total)
      setLines(built.lines)
      setInvoiceDetails(built.details)
      return
    }

    setInvoiceDetails(nextDetails)
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine()])
  }

  const removeLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== lineId) : prev))
  }

  const applyInvoiceTotals = useCallback(
    (amounts: { base: number; quota: number; total: number; irpf?: number }) => {
      if (!invoiceDetails) return
      const currentTotal = getInvoiceThirdPartyTotal(lines, invoiceMode)
      const total = currentTotal > 0 ? currentTotal : amounts.total
      if (total <= 0) return
      const built = rebuildInvoiceFromTotal(lines, invoiceDetails, entry?.commandCode, total)
      setLines(built.lines)
      setInvoiceDetails(built.details)
    },
    [entry?.commandCode, invoiceDetails, invoiceMode, lines],
  )

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
      const candidates = toShortcutCandidates(thirdParties, ledgerSubaccounts)
      const resolvedLines = lines.map((line) => {
        const shortcut = resolveAccountShortcut(line.cuenta, candidates)
        return shortcut ? { ...line, cuenta: shortcut.formattedAccountCode } : line
      })
      const expandedShortcut = resolvedLines.some((line, index) => line.cuenta !== lines[index]?.cuenta)
      const thirdLine = resolvedLines.find(
        (line) => isThirdPartyAccountPrefix(line.cuenta) || Boolean(parseDottedAccountShortcut(line.cuenta)),
      )
      const party = thirdLine ? lookupPartyForAccount(thirdLine.cuenta) : null
      const linesToSave =
        expandedShortcut && party?.name
          ? applyPartyToInvoice(resolvedLines, party.name, entry.commandCode, party.cif)
          : resolvedLines
      const detailsToSave =
        expandedShortcut && party?.name && invoiceDetails
          ? { ...invoiceDetails, nif: party.cif || invoiceDetails.nif, thirdPartyName: party.name }
          : invoiceDetails

      const year = Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()
      for (const line of linesToSave) {
        const code = line.cuenta.trim()
        if (!code || parseNewAccountPrefix(code)) continue
        if (resolveAccountShortcut(code, candidates)) continue
        const data = await apiFetch<{ success: true; year: number } & AccountExistenceResult>(
          `/api/accounting/accounts/exists?code=${encodeURIComponent(code)}&year=${year}`,
        )
        if (!data.exists) {
          promptMissingAccount(line.id, data)
          setIsSaving(false)
          return
        }
      }

      await apiFetch(`/api/accounting/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fecha,
          issueDate: detailsToSave?.issueDate ?? entry.issueDate,
          operationDate: detailsToSave?.operationDate ?? entry.operationDate,
          invoiceNumber: detailsToSave?.invoiceNumber ?? entry.invoiceNumber,
          invoiceDetails: showInvoicePanel ? detailsToSave : null,
          commandCode: entry.commandCode,
          lines: linesToSave.map(({ cuenta, concepto, debe, haber }) => ({
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

  const closeEditor = () => {
    if (missingAccount || newSubaccountPrefix) return
    onClose()
  }

  return (
    <>
    <AccountingModal
      open={open}
      title="Modificación de apunte"
      subtitle={
        entry ? formatEntryRefLabel(entry.refNumber, entry.commandCode) : undefined
      }
      onClose={closeEditor}
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
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={!totals.isBalanced || isSaving || isLoading || isDeleting}
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
                  Eliminar asiento
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
              onChange={handleInvoiceDetailsChange}
              onApplyTotals={applyInvoiceTotals}
              onOpenPgcChart={() => undefined}
              onOpenNifLookup={() => undefined}
              deriveFromTotal
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
                  const derivedAmount =
                    showInvoicePanel && isDerivedInvoiceAmountAccount(line.cuenta)

                  return (
                  <tr key={line.id} className="border-t border-sand-100">
                    <td className="px-2 py-1">
                      <Input
                        value={line.cuenta}
                        onChange={(event) => updateLine(line.id, { cuenta: event.target.value })}
                        onBlur={(event) => {
                          void commitAccountLine(line, event.target.value)
                        }}
                        className="h-9 font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={line.concepto}
                        onChange={(event) => updateLine(line.id, { concepto: event.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debe || ""}
                        readOnly={derivedAmount}
                        tabIndex={derivedAmount ? -1 : undefined}
                        onChange={(event) =>
                          handleLineAmountChange(
                            line,
                            "debe",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                        className={cn(
                          "h-9 text-right font-mono",
                          derivedAmount && "bg-sand-50 text-graphite-600",
                        )}
                        title={
                          derivedAmount
                            ? "Se calcula desde el total del cliente o proveedor"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.haber || ""}
                        readOnly={derivedAmount}
                        tabIndex={derivedAmount ? -1 : undefined}
                        onChange={(event) =>
                          handleLineAmountChange(
                            line,
                            "haber",
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                        className={cn(
                          "h-9 text-right font-mono",
                          derivedAmount && "bg-sand-50 text-graphite-600",
                        )}
                        title={
                          derivedAmount
                            ? "Se calcula desde el total del cliente o proveedor"
                            : undefined
                        }
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
    <MissingAccountDialog
      open={missingAccount !== null}
      year={Number.parseInt(fecha.slice(0, 4), 10) || new Date().getFullYear()}
      account={missingAccount}
      onConfirm={handleMissingAccountConfirm}
      onCancel={handleMissingAccountCancel}
    />
    <NewSubaccountDialog
      open={newSubaccountPrefix !== null}
      prefix={newSubaccountPrefix}
      fixedAccountCode={fixedAccountCode}
      onClose={handleCreateAccountClose}
      onCreated={handleSubaccountCreated}
    />
    </>
  )
}
