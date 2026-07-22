import type { AccountingCommandCode } from "@/lib/types/accounting-entry"

export type InvoiceConceptCommand = Extract<AccountingCommandCode, "17" | "34">

export const INVOICE_CONCEPT_PREFIX: Record<InvoiceConceptCommand, string> = {
  "17": "Nuestra factura N.",
  "34": "Su factura N.",
}

export function isInvoiceConceptCommand(
  code: AccountingCommandCode | null,
): code is InvoiceConceptCommand {
  return code === "17" || code === "34"
}

export function buildInvoiceLineConcept(
  code: InvoiceConceptCommand,
  invoiceNumber: string,
): string {
  const prefix = INVOICE_CONCEPT_PREFIX[code]
  const number = invoiceNumber.trim()
  return number ? `${prefix} ${number}` : `${prefix} `
}

export function isInvoiceConceptAccountLine(
  cuenta: string,
  code: InvoiceConceptCommand,
): boolean {
  const digits = cuenta.replace(/\D/g, "")
  if (!digits) return false

  if (code === "17") {
    return (
      digits.startsWith("477") ||
      digits.startsWith("700") ||
      digits.startsWith("705") ||
      digits.startsWith("708")
    )
  }

  return (
    digits.startsWith("472") ||
    digits.startsWith("600") ||
    digits.startsWith("601") ||
    digits.startsWith("602") ||
    digits.startsWith("620") ||
    digits.startsWith("621") ||
    digits.startsWith("622") ||
    digits.startsWith("623") ||
    digits.startsWith("624") ||
    digits.startsWith("625") ||
    digits.startsWith("626") ||
    digits.startsWith("627") ||
    digits.startsWith("628") ||
    digits.startsWith("629")
  )
}

export function applyInvoiceConceptsToLines<
  T extends { cuenta: string; concepto: string },
>(lines: T[], code: InvoiceConceptCommand, invoiceNumber: string): T[] {
  const concept = buildInvoiceLineConcept(code, invoiceNumber)
  return lines.map((line) =>
    isInvoiceConceptAccountLine(line.cuenta, code) ? { ...line, concepto: concept } : line,
  )
}
