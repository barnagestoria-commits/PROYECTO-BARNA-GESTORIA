export type TaxPeriodCode = "1T" | "2T" | "3T" | "4T" | "0A" | string

export type TaxDeclarationType = "I" | "G" | "N" | "U" | "C"

export interface TaxReturnContext {
  modelCode: string
  year: number
  period: TaxPeriodCode
  companyNif: string
  companyName: string
  declarationType?: TaxDeclarationType
  /** Versión normativa AEAT, p. ej. AEAT:303:2026:1T:101 */
  versionKey?: string
}

export interface TaxFactSourceRef {
  entryId?: string
  lineId?: string
  concept?: string
  accountCode?: string
}

export interface TaxFact {
  id: string
  companyId: string
  modelCode: string
  year: number
  period: TaxPeriodCode
  factType: string
  casilla?: string
  amount: number
  currency: "EUR"
  sourceRefs: TaxFactSourceRef[]
  metadata?: Record<string, string>
  createdAt: Date
}

export interface TaxCasillaValue {
  casilla: string
  amount: number
  sources?: TaxFactSourceRef[]
}

export interface TaxReturnDraft {
  context: TaxReturnContext
  casillas: TaxCasillaValue[]
  facts: TaxFact[]
}

export interface TaxValidationIssue {
  code: string
  message: string
  severity: "error" | "warning"
}

export interface TaxValidationResult {
  valid: boolean
  modelCode: string
  format: string
  issues: TaxValidationIssue[]
}

export interface TaxExportArtifact {
  filename: string
  content: Buffer
  mimeType: string
  format: string
  byteLength: number
  validation: TaxValidationResult
}

export interface AeatOfficialSourceMeta {
  id: string
  modelCode: string
  exercise: number
  revision: string
  label: string
  url: string
  sha256Prefix: string
  effectiveFrom: string
  format: "dr303-envelope" | "boe-500" | "xml-ws"
}
