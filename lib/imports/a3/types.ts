export interface A3ThirdParty {
  cif: string
  name: string
  type: "PROVEEDOR" | "CLIENTE"
  accountCode?: string
}

export interface A3Subaccount {
  accountCode: string
  name: string
  nif?: string
}

export interface A3JournalLine {
  fecha: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
  documento?: string
  lineMarker?: "I" | "M" | "U"
  /** Proveedor/cliente detectado (TCLIPRO o SUENLACE) pendiente de resolver a 400/430 */
  vendorCif?: string
  vendorName?: string
}

export interface A3JournalEntry {
  fecha: string
  documento: string
  concepto: string
  lines: A3JournalLine[]
  recordTypes: string[]
}

export interface A3ZipContents {
  fileNames: string[]
  subaccountSource: "subcuent.txt" | "subcue.dat" | "suenlace" | null
  journalSource: "diario.txt" | "asient.dat" | "suenlace" | null
  linkFormat: "suenlace-v950" | "native-v950" | "ascii-text" | "mixed"
  importMode: "native-export" | "suenlace-matrix" | "ascii-text"
}

export interface A3ImportPreview {
  versionLabel: string
  companyCode: string | null
  fiscalYear: number | null
  entryCount: number
  subaccountCount: number
  newSubaccountCount: number
  thirdPartyCount: number
  newThirdPartyCount: number
  recordTypes: string[]
  contents: A3ZipContents
  entries: A3JournalEntry[]
  subaccounts: A3Subaccount[]
  thirdParties: A3ThirdParty[]
  warnings: string[]
}

export interface A3ImportResult {
  id: string
  fileName: string
  entriesCreated: number
  subaccountsCreated: number
  thirdPartiesCreated: number
  linesImported: number
  status: "PROCESADO"
}
