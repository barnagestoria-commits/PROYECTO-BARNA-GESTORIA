import type { AccountingCommandCode, AccountingEntryLine, EntryCellField } from "@/lib/types/accounting-entry"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import {
  calculateInvoiceAmountsWithIrpf,
  type InvoiceAmountsWithIrpf,
} from "@/lib/accounting/invoice-auto-fill"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"

export type LineAmountSide = "debe" | "haber"

export interface EntryNavigationContext {
  activeCommand: AccountingCommandCode | null
  invoiceMode: "emitida" | "recibida"
  invoiceDetails: InvoiceEntryDetails | null
  lines: AccountingEntryLine[]
}

function accountDigits(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function isVatAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.startsWith("472") || digits.startsWith("477")
}

function isBaseAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return /^[567]/.test(digits) && !isVatAccount(cuenta) && !isThirdPartyAccountPrefix(cuenta)
}

function isIrpfAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.startsWith("473") || digits.startsWith("4751")
}

function getAccountGroup(cuenta: string): number | null {
  const digits = accountDigits(cuenta)
  if (!digits) return null
  const group = Number.parseInt(digits.charAt(0), 10)
  return Number.isNaN(group) ? null : group
}

export function findInvoiceLineIndices(lines: AccountingEntryLine[]) {
  return {
    thirdParty: lines.findIndex((line) => isThirdPartyAccountPrefix(line.cuenta)),
    vat: lines.findIndex((line) => isVatAccount(line.cuenta)),
    base: lines.findIndex((line) => isBaseAccount(line.cuenta)),
    irpf: lines.findIndex((line) => isIrpfAccount(line.cuenta)),
  }
}

/** Naturaleza contable del importe según cuenta y contexto de factura (estilo A3). */
export function getLineAmountSide(
  rowIndex: number,
  line: AccountingEntryLine,
  context: EntryNavigationContext,
): LineAmountSide | null {
  const cuenta = line.cuenta.trim()
  if (!cuenta) return null

  const { thirdParty, vat, base, irpf } = findInvoiceLineIndices(context.lines)
  const emitida = context.invoiceMode === "emitida"
  const hasInvoiceStructure = thirdParty >= 0 && (vat >= 0 || base >= 0)

  if (hasInvoiceStructure) {
    if (rowIndex === thirdParty) return emitida ? "debe" : "haber"
    if (rowIndex === vat) return emitida ? "haber" : "debe"
    if (rowIndex === base) return emitida ? "haber" : "debe"
    if (rowIndex === irpf && irpf >= 0) return emitida ? "debe" : "haber"
  }

  const digits = accountDigits(cuenta)
  const group = getAccountGroup(cuenta)

  if (group === 6) return "debe"
  if (group === 7) return "haber"
  if (digits.startsWith("472")) return "debe"
  if (digits.startsWith("477")) return "haber"
  if (digits.startsWith("473") || digits.startsWith("4751")) {
    return emitida ? "debe" : "haber"
  }
  if (digits.startsWith("430")) return "debe"
  if (digits.startsWith("400") || digits.startsWith("410")) return "haber"
  if (group === 1 || group === 2 || group === 3) return "debe"
  if (group === 4 && !digits.startsWith("43")) return "haber"

  return "debe"
}

export function getInvoiceAmountsFromDetails(
  details: InvoiceEntryDetails | null,
): InvoiceAmountsWithIrpf | null {
  if (!details) return null
  const amounts = calculateInvoiceAmountsWithIrpf(details)
  if (amounts.base <= 0 && amounts.quota <= 0 && amounts.total <= 0) return null
  return amounts
}

/** Importe precalculado del panel de factura para la línea actual. */
export function getLinePrefilledAmount(
  rowIndex: number,
  context: EntryNavigationContext,
): number {
  const amounts = getInvoiceAmountsFromDetails(context.invoiceDetails)
  if (!amounts) return 0

  const { thirdParty, vat, base, irpf } = findInvoiceLineIndices(context.lines)
  const emitida = context.invoiceMode === "emitida"

  if (rowIndex === thirdParty) return amounts.total
  if (rowIndex === vat) return amounts.quota
  if (rowIndex === base) return amounts.base
  if (rowIndex === irpf && amounts.irpf > 0) return amounts.irpf

  if (emitida && rowIndex === thirdParty) return amounts.total
  return 0
}

export function applyAmountToLineSide(
  line: AccountingEntryLine,
  side: LineAmountSide,
  amount: number,
): AccountingEntryLine {
  if (side === "debe") {
    return { ...line, debe: amount, haber: 0 }
  }
  return { ...line, debe: 0, haber: amount }
}

const ROW0_PREFIX_FIELDS: EntryCellField[] = ["fecha", "codigo"]
const ROW0_SUFFIX_FIELDS: EntryCellField[] = ["concepto", "documento", "cuenta"]
const MANUAL_PREFIX_FIELDS: EntryCellField[] = ["concepto", "documento", "cuenta"]

function isConceptFieldSkippable(
  rowIndex: number,
  line: AccountingEntryLine,
  activeCommand: AccountingCommandCode | null,
): boolean {
  if (activeCommand !== "17" && activeCommand !== "34") return false
  if (isThirdPartyAccountPrefix(line.cuenta)) return true

  const digits = accountDigits(line.cuenta)
  if (!digits) return false
  if (activeCommand === "17") {
    return digits.startsWith("477") || digits.startsWith("7")
  }
  return digits.startsWith("472") || /^6/.test(digits)
}

/** Campos navegables con Tab, omitiendo Debe/Haber inactivos y conceptos bloqueados. */
export function getNavigableFieldsForRow(
  rowIndex: number,
  line: AccountingEntryLine,
  context: EntryNavigationContext,
): EntryCellField[] {
  const prefix = rowIndex === 0 ? ROW0_PREFIX_FIELDS : []
  const middle = rowIndex === 0 ? ROW0_SUFFIX_FIELDS : MANUAL_PREFIX_FIELDS
  const fields: EntryCellField[] = [...prefix]

  for (const field of middle) {
    if (field === "concepto" && isConceptFieldSkippable(rowIndex, line, context.activeCommand)) {
      continue
    }
    fields.push(field)
  }

  const side = getLineAmountSide(rowIndex, line, context)
  if (side) {
    fields.push(side)
  } else {
    fields.push("debe", "haber")
  }

  fields.push("contrapartida")
  return fields
}

export function getNextNavigableField(
  rowIndex: number,
  field: EntryCellField,
  context: EntryNavigationContext,
): { row: number; field: EntryCellField } | null {
  const line = context.lines[rowIndex]
  if (!line) return null

  if (field === "debe" || field === "haber") {
    const nextInvoiceRow = getNextInvoiceAmountRow(rowIndex, context)
    if (nextInvoiceRow !== null) {
      const nextLine = context.lines[nextInvoiceRow]
      const nextSide = nextLine ? getLineAmountSide(nextInvoiceRow, nextLine, context) : null
      if (nextSide) return { row: nextInvoiceRow, field: nextSide }
    }
  }

  const fields = getNavigableFieldsForRow(rowIndex, line, context)
  const fieldIndex = fields.indexOf(field)

  if (fieldIndex >= 0 && fieldIndex < fields.length - 1) {
    return { row: rowIndex, field: fields[fieldIndex + 1] }
  }

  if (rowIndex < context.lines.length - 1) {
    const nextRow = rowIndex + 1
    const nextLine = context.lines[nextRow]
    if (nextLine) {
      const nextFields = getNavigableFieldsForRow(nextRow, nextLine, context)
      if (nextFields.length > 0) return { row: nextRow, field: nextFields[0] }
    }
  }

  return null
}

/** Tras el importe, salta a la siguiente línea de IVA/base del asiento de factura. */
function getNextInvoiceAmountRow(
  rowIndex: number,
  context: EntryNavigationContext,
): number | null {
  const amounts = getInvoiceAmountsFromDetails(context.invoiceDetails)
  if (!amounts) return null

  const { thirdParty, vat, base, irpf } = findInvoiceLineIndices(context.lines)

  if (rowIndex === thirdParty && vat >= 0) return vat
  if (rowIndex === vat && base >= 0) return base
  if (rowIndex === base && irpf >= 0 && amounts.irpf > 0) return irpf
  return null
}

export function isAmountFieldDisabled(
  rowIndex: number,
  line: AccountingEntryLine,
  field: "debe" | "haber",
  context: EntryNavigationContext,
): boolean {
  const side = getLineAmountSide(rowIndex, line, context)
  if (!side) return false
  return field !== side
}
