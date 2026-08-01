export interface BankMovementDraft {
  movementDate: string
  valueDate?: string
  concept: string
  reference?: string
  /** Positivo = abono/ingreso; negativo = cargo/salida */
  amount: number
  balance?: number
}

export interface BankImportPreview {
  fileName: string
  source: "CSV" | "XLSX" | "OCR"
  movements: BankMovementDraft[]
  warnings: string[]
}

export interface BankMovementView {
  id: string
  movementDate: string
  valueDate: string | null
  concept: string
  reference: string | null
  amount: number
  balance: number | null
  status: "PENDIENTE" | "CONCILIADO" | "IGNORADO"
  importFileName: string | null
  matchedEntryId: string | null
  matchedEntryRef: number | null
  matchedLineId: string | null
  matchedAt: string | null
}

export interface ReconciliationCandidate {
  entryLineId: string
  entryId: string
  entryRef: number
  entryDate: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
  score: number
  reason: string
}

export interface BankReconciliationSummary {
  pendingCount: number
  reconciledCount: number
  ignoredCount: number
  pendingAmount: number
}
