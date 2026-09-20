export type FiscalExportFormat = "pdf" | "xlsx" | "csv" | "txt" | "lsi" | "zip"

export const FISCAL_EXPORT_FORMATS: FiscalExportFormat[] = ["pdf", "xlsx", "csv", "txt", "lsi", "zip"]

export const FISCAL_EXPORT_LABELS: Record<FiscalExportFormat, string> = {
  pdf: "PDF",
  xlsx: "Excel interno",
  csv: "CSV",
  txt: "Fichero del modelo",
  lsi: "Libros Excel Hacienda",
  zip: "Guardar todo",
}

export const FISCAL_EXPORT_DESCRIPTIONS: Record<FiscalExportFormat, string> = {
  pdf: "Documento formal para archivo e impresión. No sustituye al fichero de Hacienda.",
  xlsx: "Hoja de cálculo del desglose interno de Barna. No sirve para importar en la Sede.",
  csv: "Texto delimitado para sistemas externos",
  txt: "Fichero oficial para importar y presentar el modelo en la Sede Electrónica de la AEAT",
  lsi: "Libros registro .xlsx para que Hacienda rellene casillas del 130, Pre303 y Renta WEB",
  zip: "Paquete con PDF, desglose interno y todos los ficheros oficiales, por si hay que presentar a mano",
}
