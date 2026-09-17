import type { DuplicateInvoiceMatch } from "@/lib/accounting/duplicate-invoice"

export function formatDuplicateInvoiceDate(fecha: string): string {
  const [year, month, day] = fecha.split("-")
  if (!year || !month || !day) return fecha
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`
}

export function describeDuplicateInvoice(duplicate: DuplicateInvoiceMatch): string {
  return `Ya existe el asiento ${duplicate.refNumber} con el nº ${duplicate.invoiceNumber} (${formatDuplicateInvoiceDate(duplicate.fecha)}).`
}

export function duplicateInvoiceKey(duplicate: DuplicateInvoiceMatch): string {
  return `${duplicate.entryId}:${duplicate.refNumber}:${normalizeDuplicateInvoiceNumber(duplicate.invoiceNumber)}`
}

function normalizeDuplicateInvoiceNumber(value: string): string {
  return value.trim().toUpperCase()
}
