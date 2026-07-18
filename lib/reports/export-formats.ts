export type ReportExportFormat = "pdf" | "xlsx" | "csv" | "zip"

export const REPORT_EXPORT_FORMATS: ReportExportFormat[] = ["pdf", "xlsx", "csv", "zip"]

export const REPORT_EXPORT_LABELS: Record<ReportExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
  zip: "ZIP",
}

export const REPORT_EXPORT_DESCRIPTIONS: Record<ReportExportFormat, string> = {
  pdf: "Documento formal para archivo e impresión",
  xlsx: "Hoja de cálculo editable",
  csv: "Texto delimitado para Hacienda y sistemas externos",
  zip: "Paquete PDF + Excel + CSV para registro mercantil",
}
