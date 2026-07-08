export type FiscalModelId = "111" | "115" | "303"

export type FiscalPeriodKey = "q1" | "q2" | "q3" | "q4" | "annual"

export type FiscalCellStatus = "sin_datos" | "pendiente" | "presentado"

export type FiscalBlockId = "IRPF" | "IVA"

export interface FiscalPanoramaCell {
  period: FiscalPeriodKey
  amount: number
  status: FiscalCellStatus
  statusLabel: string
  entryCount: number
  lineCount: number
  href: string
}

export interface FiscalPanoramaRow {
  modelCode: FiscalModelId
  modelLabel: string
  description: string
  cells: Record<FiscalPeriodKey, FiscalPanoramaCell>
}

export interface FiscalPanoramaBlock {
  id: FiscalBlockId
  label: string
  rows: FiscalPanoramaRow[]
}

export interface FiscalPanoramaSummary {
  label: string
  cells: Record<FiscalPeriodKey, FiscalPanoramaCell>
}

export interface FiscalPanoramaResponse {
  year: number
  companyId: string
  companyName: string
  generatedAt: string
  blocks: FiscalPanoramaBlock[]
  summary: FiscalPanoramaSummary
}

export interface FiscalModelBreakdownLine {
  entryId: string
  entryDate: string
  lineId: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
  signedAmount: number
  category?: string
}

export interface FiscalModelDetailResponse {
  modelCode: FiscalModelId
  modelLabel: string
  year: number
  quarter: number | "annual"
  periodLabel: string
  amount: number
  status: FiscalCellStatus
  statusLabel: string
  breakdown: Array<{
    key: string
    label: string
    total: number
    lines: FiscalModelBreakdownLine[]
  }>
}

export const FISCAL_PERIOD_COLUMNS: Array<{ key: FiscalPeriodKey; label: string }> = [
  { key: "q1", label: "1T" },
  { key: "q2", label: "2T" },
  { key: "q3", label: "3T" },
  { key: "q4", label: "4T" },
  { key: "annual", label: "Resumen anual" },
]
