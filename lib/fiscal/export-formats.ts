export type FiscalExportFormat = "pdf" | "xlsx" | "csv" | "txt" | "zip"

export const FISCAL_EXPORT_FORMATS: FiscalExportFormat[] = ["pdf", "xlsx", "csv", "txt", "zip"]

export const FISCAL_EXPORT_LABELS: Record<FiscalExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
  txt: "TXT Hacienda",
  zip: "ZIP",
}

export const FISCAL_EXPORT_DESCRIPTIONS: Record<FiscalExportFormat, string> = {
  pdf: "Documento formal para archivo e impresión",
  xlsx: "Hoja de cálculo editable",
  csv: "Texto delimitado para sistemas externos",
  txt: "Archivo .txt de importación telemática en AEAT",
  zip: "Paquete con PDF, Excel, CSV y TXT",
}
