import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

export interface DraftCasilla {
  id: string
  code: string
  label: string
  description?: string
  amount: number
  baseAmount?: number
  relatedCode?: string
  sectionKey?: string
  clickable: boolean
}

export interface DraftSection {
  id: string
  title: string
  casillas: DraftCasilla[]
}

export interface FiscalModelDraft {
  modelCode: FiscalModelId
  modelLabel: string
  year: number
  quarter: number | "annual"
  periodLabel: string
  nif: string
  companyName: string
  status: string
  statusLabel: string
  sections: DraftSection[]
  resultAmount: number
  supportsGenerateEntry: boolean
  hasExistingLiquidation: boolean
}

export interface CalculationDetailRow {
  id: string
  entryId: string
  lineId: string
  cuenta: string
  nif: string
  nombre: string
  claveOperacion: string
  importe: number
  concepto: string
  entryDate: string
}

export const DRAFT_SUPPORTED_MODELS = new Set<FiscalModelId>([
  "111",
  "115",
  "123",
  "180",
  "190",
  "303",
  "347",
  "349",
  "390",
])
