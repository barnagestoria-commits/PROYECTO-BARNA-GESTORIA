export interface PortfolioCompanyCandidate {
  clientCode: string
  name: string
  cif: string | null
  entityType: "juridica" | "fisica"
  source: "a3-folder" | "csv" | "xlsx"
  folderPath?: string
  /** Asientos detectados en la carpeta A3 (solo preview ZIP) */
  entryCount?: number | null
  hasAccountingData?: boolean
}

export type PortfolioCandidateStatus = "new" | "exists" | "skipped"

export interface PortfolioCandidatePreview extends PortfolioCompanyCandidate {
  status: PortfolioCandidateStatus
  existingCompanyId?: string
  existingCompanyName?: string
  skipReason?: string
}

export interface PortfolioImportPreview {
  fileName: string
  sourceType: "multi-zip" | "csv" | "xlsx" | "unsupported"
  candidates: PortfolioCandidatePreview[]
  warnings: string[]
  newCount: number
  existingCount: number
  skippedCount: number
  accountingEntryCount: number
  newWithAccountingCount: number
}

export interface PortfolioCompanyAccountingResult {
  entriesCreated: number
  linesImported: number
  subaccountsCreated: number
  thirdPartiesCreated: number
  error?: string
}

export interface PortfolioImportResult {
  fileName: string
  created: number
  skipped: number
  alreadyExists: number
  accountingImported: number
  accountingFailed: number
  totalEntriesCreated: number
  companies: Array<{
    id: string
    name: string
    cif: string | null
    clientCode: string
    accounting?: PortfolioCompanyAccountingResult
  }>
}
