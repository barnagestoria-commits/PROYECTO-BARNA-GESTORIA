import type { AccountingCommandCode, AccountingEntryLine } from "@/lib/types/accounting-entry"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"

export type InvoiceConceptCommand = Extract<AccountingCommandCode, "17" | "34">

export const INVOICE_CONCEPT_PREFIX: Record<InvoiceConceptCommand, string> = {
  "17": "Nuestra factura N.",
  "34": "Su factura N.",
}

/** Concepto de la línea de tercero (430/400) cuando aún no hay número de factura. */
export const THIRD_PARTY_INVOICE_CONCEPT: Record<InvoiceConceptCommand, string> = {
  "17": "Nuestra Factura",
  "34": "Su Factura",
}

export interface InvoiceConceptOptions {
  invoiceNumber: string
  thirdPartyLabel?: string
  invoiceMode?: "emitida" | "recibida"
}

export function isInvoiceConceptCommand(
  code: AccountingCommandCode | null,
): code is InvoiceConceptCommand {
  return code === "17" || code === "34"
}

export function formatPartyLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  return trimmed.toUpperCase().replace(/\s+/g, "-")
}

export function defaultPartyLabel(invoiceMode: "emitida" | "recibida"): string {
  return invoiceMode === "emitida" ? "CLIENTES-VARIOS" : "PROVEEDORES-VARIOS"
}

export function resolveThirdPartyLabel(
  lines: Array<Pick<AccountingEntryLine, "cuenta" | "concepto">>,
  options: Pick<InvoiceConceptOptions, "thirdPartyLabel" | "invoiceMode">,
): string {
  if (options.thirdPartyLabel?.trim()) {
    return formatPartyLabel(options.thirdPartyLabel) || defaultPartyLabel(options.invoiceMode ?? "emitida")
  }

  const thirdIdx = lines.findIndex((line) => isThirdPartyAccountPrefix(line.cuenta))
  const concept = lines[thirdIdx]?.concepto?.trim() ?? ""
  if (concept && concept !== "Cliente" && concept !== "Proveedor" && concept !== "Nuestra Factura" && concept !== "Su Factura") {
    const formatted = formatPartyLabel(concept)
    if (formatted && !concept.toLowerCase().startsWith("nuestra factura") && !concept.toLowerCase().startsWith("su factura")) {
      return formatted
    }
  }

  return defaultPartyLabel(options.invoiceMode ?? "emitida")
}

export function buildInvoiceLineConcept(
  code: InvoiceConceptCommand,
  invoiceNumber: string,
): string {
  const number = invoiceNumber.trim()
  if (code === "17") {
    return number ? `Nuestra factura N. ${number}` : THIRD_PARTY_INVOICE_CONCEPT["17"]
  }
  return number ? `Su factura N. ${number}` : THIRD_PARTY_INVOICE_CONCEPT["34"]
}

function accountDigits(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function isVatAccountEmitida(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("477")
}

function isVatAccountRecibida(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("472")
}

function isIncomeAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.length > 0 && digits.startsWith("7")
}

function isExpenseAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return /^6[0-9]/.test(digits) && !isVatAccountRecibida(cuenta)
}

export function buildLineConceptForInvoice(
  line: Pick<AccountingEntryLine, "cuenta" | "concepto">,
  code: InvoiceConceptCommand,
  options: InvoiceConceptOptions,
  allLines: Array<Pick<AccountingEntryLine, "cuenta" | "concepto">>,
): string {
  const partyLabel = resolveThirdPartyLabel(allLines, options)
  const invoiceNumber = options.invoiceNumber

  if (code === "17") {
    if (isThirdPartyAccountPrefix(line.cuenta)) {
      return buildInvoiceLineConcept("17", invoiceNumber)
    }
    if (isVatAccountEmitida(line.cuenta)) {
      return `IVA R./${partyLabel}`
    }
    if (isIncomeAccount(line.cuenta)) {
      return `Ventas a ${partyLabel}`
    }
  }

  if (code === "34") {
    if (isThirdPartyAccountPrefix(line.cuenta)) {
      return buildInvoiceLineConcept("34", invoiceNumber)
    }
    if (isVatAccountRecibida(line.cuenta)) {
      return `IVA S./${partyLabel}`
    }
    if (isExpenseAccount(line.cuenta)) {
      return `Gasto a ${partyLabel}`
    }
  }

  return line.concepto
}

export function isInvoiceConceptAccountLine(
  cuenta: string,
  code: InvoiceConceptCommand,
): boolean {
  const digits = accountDigits(cuenta)
  if (!digits) return false

  if (code === "17") {
    return isVatAccountEmitida(cuenta) || isIncomeAccount(cuenta)
  }

  return isVatAccountRecibida(cuenta) || isExpenseAccount(cuenta)
}

export function applyInvoiceConceptsToLines<
  T extends { cuenta: string; concepto: string },
>(lines: T[], code: InvoiceConceptCommand, options: InvoiceConceptOptions): T[] {
  const normalized: InvoiceConceptOptions = {
    invoiceNumber: options.invoiceNumber,
    thirdPartyLabel: options.thirdPartyLabel,
    invoiceMode: options.invoiceMode ?? (code === "17" ? "emitida" : "recibida"),
  }

  return lines.map((line) => {
    if (isThirdPartyAccountPrefix(line.cuenta) || isInvoiceConceptAccountLine(line.cuenta, code)) {
      return {
        ...line,
        concepto: buildLineConceptForInvoice(line, code, normalized, lines),
      }
    }
    return line
  })
}
