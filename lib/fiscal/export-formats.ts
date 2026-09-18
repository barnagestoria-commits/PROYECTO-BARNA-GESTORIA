export type FiscalExportFormat = "pdf" | "xlsx" | "csv" | "txt" | "lsi" | "zip"

export const FISCAL_EXPORT_FORMATS: FiscalExportFormat[] = ["pdf", "xlsx", "csv", "txt", "lsi", "zip"]

export const FISCAL_EXPORT_LABELS: Record<FiscalExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel",
  csv: "CSV",
  txt: "TXT Hacienda",
  lsi: "Excel Hacienda",
  zip: "ZIP",
}

export const FISCAL_EXPORT_DESCRIPTIONS: Record<FiscalExportFormat, string> = {
  pdf: "Documento formal para archivo e impresión",
  xlsx: "Hoja de cálculo editable del desglose interno",
  csv: "Texto delimitado para sistemas externos",
  txt: "Descargar fichero (.txt) para importar en la Sede Electrónica de la AEAT",
  lsi: "Libros registro .xlsx para importar en el modelo 130, Pre303 y Renta WEB",
  zip: "Paquete con PDF, Excel, CSV, TXT y libros registro",
}
