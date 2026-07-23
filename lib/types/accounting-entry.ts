import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"

export type AccountingCommandCode = "17" | "34" | "16" | "57" | "303"

export interface AccountingEntryLine {
  id: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
  documento?: string
  contrapartida?: string
}

export interface AccountingCommandTemplate {
  code: AccountingCommandCode
  label: string
  description: string
  lines: Omit<AccountingEntryLine, "id">[]
}

export type LineValidationSeverity = "error" | "warning"

export interface LineValidation {
  lineId: string
  message: string
  severity: LineValidationSeverity
}

export interface EntryTotals {
  debe: number
  haber: number
  difference: number
  isBalanced: boolean
}

export type EntryCellField =
  | "fecha"
  | "codigo"
  | "concepto"
  | "documento"
  | "cuenta"
  | "debe"
  | "haber"
  | "contrapartida"

/** Orden de tabulación en la primera línea del asiento (estilo A3CON). */
export const ENTRY_ROW0_CELL_FIELDS: EntryCellField[] = [
  "fecha",
  "codigo",
  "concepto",
  "documento",
  "cuenta",
  "debe",
  "haber",
  "contrapartida",
]

/** Líneas adicionales del mismo asiento: sin fecha ni código predefinido. */
export const ENTRY_MANUAL_LINE_FIELDS: EntryCellField[] = [
  "concepto",
  "documento",
  "cuenta",
  "debe",
  "haber",
  "contrapartida",
]

/** @deprecated Usar getCellFieldsForRow */
export const ENTRY_CELL_FIELDS: EntryCellField[] = ENTRY_ROW0_CELL_FIELDS

export function getCellFieldsForRow(row: number): EntryCellField[] {
  return row === 0 ? ENTRY_ROW0_CELL_FIELDS : ENTRY_MANUAL_LINE_FIELDS
}

export interface CreateAccountingEntryLineInput {
  cuenta: string
  concepto: string
  debe: number
  haber: number
  analyticDistributions?: Array<{
    costCenterId: string
    percentage: number
    amount: number
  }>
}

export interface CreateAccountingEntryRequest {
  fecha: string
  issueDate?: string | null
  operationDate?: string | null
  invoiceNumber?: string | null
  invoiceDetails?: InvoiceEntryDetails | null
  commandCode?: AccountingCommandCode | null
  lines: CreateAccountingEntryLineInput[]
}

export interface AccountingEntryResponse {
  id: string
  companyId: string
  refNumber: number
  fecha: string
  issueDate?: string | null
  operationDate?: string | null
  invoiceNumber?: string | null
  commandCode: AccountingCommandCode | null
  lines: Array<{
    id: string
    sortOrder: number
    cuenta: string
    concepto: string
    debe: number
    haber: number
  }>
  totals: EntryTotals
  createdAt: string
}
