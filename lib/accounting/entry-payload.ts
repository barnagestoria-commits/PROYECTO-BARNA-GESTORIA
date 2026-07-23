import type {
  AccountingCommandCode,
  AccountingEntryLine,
  AccountingEntryResponse,
  CreateAccountingEntryLineInput,
  EntryTotals,
} from "@/lib/types/accounting-entry"
import {
  createDefaultInvoiceDetails,
  type InvoiceEntryDetails,
} from "@/lib/types/invoice-entry-details"

export interface AccountingEntryDetail extends AccountingEntryResponse {
  issueDate: string | null
  operationDate: string | null
  invoiceNumber: string | null
  invoiceDetails: InvoiceEntryDetails | null
}

export interface SaveAccountingEntryInput {
  fecha: string
  issueDate?: string | null
  operationDate?: string | null
  invoiceNumber?: string | null
  invoiceDetails?: InvoiceEntryDetails | null
  commandCode?: AccountingCommandCode | null
  lines: CreateAccountingEntryLineInput[]
}

export function parseEntryDate(value: string | null | undefined): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function serializeInvoiceDetails(details: InvoiceEntryDetails | null | undefined): string | null {
  if (!details) return null
  return JSON.stringify(details)
}

export function parseInvoiceDetails(json: string | null | undefined): InvoiceEntryDetails | null {
  if (!json) return null
  try {
    return JSON.parse(json) as InvoiceEntryDetails
  } catch {
    return null
  }
}

export function normalizeEntryLines(
  rawLines: CreateAccountingEntryLineInput[],
): { lines: Omit<AccountingEntryLine, "id">[] } | { error: string } {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "El asiento debe incluir al menos una línea." }
  }

  const lines = rawLines
    .map((line) => ({
      cuenta: String(line.cuenta ?? "").trim(),
      concepto: String(line.concepto ?? "").trim(),
      debe: Math.round((Number(line.debe) || 0) * 100) / 100,
      haber: Math.round((Number(line.haber) || 0) * 100) / 100,
    }))
    .filter((line) => line.cuenta || line.debe > 0 || line.haber > 0)

  if (lines.length === 0) {
    return { error: "Introduce al menos una línea con cuenta o importe." }
  }

  if (lines.some((line) => !line.cuenta)) {
    return { error: "Todas las líneas con importe deben tener cuenta contable." }
  }

  return { lines }
}

export function buildEntryDetail(params: {
  id: string
  companyId: string
  refNumber: number
  fecha: Date
  issueDate: Date | null
  operationDate: Date | null
  invoiceNumber: string | null
  invoiceDataJson: string | null
  commandCode: string | null
  createdAt: Date
  lines: Array<{
    id: string
    sortOrder: number
    cuenta: string
    concepto: string
    debe: number
    haber: number
  }>
  totals: EntryTotals
}): AccountingEntryDetail {
  const fecha = params.fecha.toISOString().split("T")[0]
  const parsedInvoice = parseInvoiceDetails(params.invoiceDataJson)
  const issueDate = params.issueDate?.toISOString().split("T")[0] ?? null
  const operationDate = params.operationDate?.toISOString().split("T")[0] ?? null

  const invoiceDetails = parsedInvoice
    ? {
        ...parsedInvoice,
        issueDate: issueDate ?? parsedInvoice.issueDate,
        operationDate: operationDate ?? parsedInvoice.operationDate,
        invoiceNumber: params.invoiceNumber ?? parsedInvoice.invoiceNumber,
      }
    : issueDate || operationDate || params.invoiceNumber
      ? {
          ...createDefaultInvoiceDetails(fecha),
          issueDate: issueDate ?? fecha,
          operationDate: operationDate ?? fecha,
          invoiceNumber: params.invoiceNumber ?? "",
        }
      : null

  return {
    id: params.id,
    companyId: params.companyId,
    refNumber: params.refNumber,
    fecha,
    issueDate,
    operationDate,
    invoiceNumber: params.invoiceNumber,
    invoiceDetails,
    commandCode: params.commandCode as AccountingCommandCode | null,
    lines: params.lines,
    totals: params.totals,
    createdAt: params.createdAt.toISOString(),
  }
}
