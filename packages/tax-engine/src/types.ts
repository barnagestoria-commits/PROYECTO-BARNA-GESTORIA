export type TaxPeriodCode = "1T" | "2T" | "3T" | "4T" | "0A" | string

export type TaxDeclarationType = "C" | "D" | "G" | "I" | "N" | "U" | "V" | "X"

export interface Model303FilingOptions {
  exclusivelyForal?: boolean
  registeredMonthlyRefund?: boolean
  jointReturn?: boolean
  cashBasisSubject?: boolean
  cashBasisRecipient?: boolean
  specialProrataOption?: boolean
  specialProrataRevocation?: boolean
  bankruptcy?: {
    /** Fecha DDMMYYYY del auto de declaración de concurso. */
    orderDate: string
    type: "PRE" | "POST"
  }
  voluntarySii?: boolean
  /** Obligatorio para 4T: exoneración del modelo 390. */
  annualSummaryExempt?: boolean
  /** Obligatorio para 4T: volumen anual de operaciones distinto de cero. */
  annualOperationsNonZero?: boolean
}

export interface TaxSoftwareIdentity {
  /** Identificador de cuatro posiciones de la versión del software. */
  version: string
  /** NIF legal de la entidad desarrolladora del software. */
  developerNif: string
}

export interface TaxReturnContext {
  modelCode: string
  year: number
  period: TaxPeriodCode
  companyNif: string
  companyName: string
  declarationType?: TaxDeclarationType
  model303?: Model303FilingOptions
  software?: TaxSoftwareIdentity
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
