export type AccountingCommandCode = "17" | "34" | "16" | "57"

export interface AccountingEntryLine {
  id: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
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

export type EntryCellField = "cuenta" | "concepto" | "debe" | "haber"

export const ENTRY_CELL_FIELDS: EntryCellField[] = ["cuenta", "concepto", "debe", "haber"]

export interface CreateAccountingEntryLineInput {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export interface CreateAccountingEntryRequest {
  fecha: string
  commandCode?: AccountingCommandCode | null
  lines: CreateAccountingEntryLineInput[]
}

export interface AccountingEntryResponse {
  id: string
  companyId: string
  fecha: string
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
