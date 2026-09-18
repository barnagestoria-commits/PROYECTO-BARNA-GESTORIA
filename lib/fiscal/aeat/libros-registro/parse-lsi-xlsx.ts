import ExcelJS from "exceljs"
import { LIBROS_REGISTRO_ISSUED_HEADERS, LIBROS_REGISTRO_RECEIVED_HEADERS } from "@/lib/fiscal/aeat/libros-registro/generate-lsi-xlsx"
import type { IssuedLibrosRow, LibrosRegistroBooks, LibrosRegistroPeriod, ReceivedLibrosRow } from "@/lib/fiscal/aeat/libros-registro/types"

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim()
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim()
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue)
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim()
    }
  }
  return String(value).trim()
}

function cellNumber(value: ExcelJS.CellValue): number | "" {
  const text = cellText(value)
  if (!text) return ""
  const parsed = Number(text.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : ""
}

function findHeaderRow(sheet: ExcelJS.Worksheet, expected: string): number | null {
  const max = Math.min(sheet.rowCount, 20)
  for (let rowNumber = 1; rowNumber <= max; rowNumber += 1) {
    const first = cellText(sheet.getRow(rowNumber).getCell(1).value)
    const second = cellText(sheet.getRow(rowNumber).getCell(2).value)
    if (first === "Ejercicio" && second === "Periodo") return rowNumber
    if (first.includes(expected) && second === "Periodo") return rowNumber
  }
  return null
}

function periodValue(value: string): LibrosRegistroPeriod {
  if (value === "1T" || value === "2T" || value === "3T" || value === "4T") return value
  return "1T"
}

export async function parseLibrosRegistroXlsx(buffer: Buffer): Promise<{
  sheetNames: string[]
  books: LibrosRegistroBooks
}> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name)

  const issuedSheet = workbook.getWorksheet("EXPEDIDAS_INGRESOS") ?? workbook.getWorksheet("INGRESOS")
  const receivedSheet = workbook.getWorksheet("RECIBIDAS_GASTOS") ?? workbook.getWorksheet("GASTOS")

  const issued: IssuedLibrosRow[] = []
  if (issuedSheet) {
    const headerRow = findHeaderRow(issuedSheet, LIBROS_REGISTRO_ISSUED_HEADERS[0] ?? "Ejercicio") ?? 8
    for (let rowNumber = headerRow + 1; rowNumber <= issuedSheet.rowCount; rowNumber += 1) {
      const row = issuedSheet.getRow(rowNumber)
      const ejercicio = cellNumber(row.getCell(1).value)
      if (ejercicio === "" || Number(ejercicio) < 2000) continue
      issued.push({
        ejercicio: Number(ejercicio),
        periodo: periodValue(cellText(row.getCell(2).value)),
        actividadCodigo: cellText(row.getCell(3).value),
        actividadTipo: cellText(row.getCell(4).value),
        epigrafe: cellText(row.getCell(5).value),
        tipoFactura: cellText(row.getCell(6).value),
        conceptoIngreso: cellText(row.getCell(7).value),
        ingresoComputable: cellNumber(row.getCell(8).value),
        fechaExpedicion: cellText(row.getCell(9).value),
        fechaOperacion: cellText(row.getCell(10).value),
        serie: cellText(row.getCell(11).value),
        numero: cellText(row.getCell(12).value),
        numeroFinal: cellText(row.getCell(13).value),
        nifTipo: cellText(row.getCell(14).value),
        nifPais: cellText(row.getCell(15).value),
        nifIdentificacion: cellText(row.getCell(16).value),
        nombreDestinatario: cellText(row.getCell(17).value),
        claveOperacion: cellText(row.getCell(18).value),
        calificacion: cellText(row.getCell(19).value),
        operacionExenta: cellText(row.getCell(20).value),
        totalFactura: Number(cellNumber(row.getCell(21).value) || 0),
        baseImponible: Number(cellNumber(row.getCell(22).value) || 0),
        tipoIva: Number(cellNumber(row.getCell(23).value) || 0),
        cuotaIva: Number(cellNumber(row.getCell(24).value) || 0),
        tipoRecargo: cellNumber(row.getCell(25).value),
        cuotaRecargo: cellNumber(row.getCell(26).value),
        tipoRetencion: cellNumber(row.getCell(31).value),
        importeRetenido: cellNumber(row.getCell(32).value),
        referenciaExterna: cellText(row.getCell(36).value),
      })
    }
  }

  const received: ReceivedLibrosRow[] = []
  if (receivedSheet) {
    const headerRow = findHeaderRow(receivedSheet, LIBROS_REGISTRO_RECEIVED_HEADERS[0] ?? "Ejercicio") ?? 8
    for (let rowNumber = headerRow + 1; rowNumber <= receivedSheet.rowCount; rowNumber += 1) {
      const row = receivedSheet.getRow(rowNumber)
      const ejercicio = cellNumber(row.getCell(1).value)
      if (ejercicio === "" || Number(ejercicio) < 2000) continue
      received.push({
        ejercicio: Number(ejercicio),
        periodo: periodValue(cellText(row.getCell(2).value)),
        actividadCodigo: cellText(row.getCell(3).value),
        actividadTipo: cellText(row.getCell(4).value),
        epigrafe: cellText(row.getCell(5).value),
        tipoFactura: cellText(row.getCell(6).value),
        conceptoGasto: cellText(row.getCell(7).value),
        gastoDeducible: cellNumber(row.getCell(8).value),
        fechaExpedicion: cellText(row.getCell(9).value),
        fechaOperacion: cellText(row.getCell(10).value),
        serieNumero: cellText(row.getCell(11).value),
        numeroFinal: cellText(row.getCell(12).value),
        fechaRecepcion: cellText(row.getCell(13).value),
        numeroRecepcion: cellText(row.getCell(14).value),
        numeroRecepcionFinal: cellText(row.getCell(15).value),
        nifTipo: cellText(row.getCell(16).value),
        nifPais: cellText(row.getCell(17).value),
        nifIdentificacion: cellText(row.getCell(18).value),
        nombreExpedidor: cellText(row.getCell(19).value),
        claveOperacion: cellText(row.getCell(20).value),
        bienInversion: cellText(row.getCell(21).value),
        inversionSujetoPasivo: cellText(row.getCell(22).value),
        deduciblePeriodoPosterior: cellText(row.getCell(23).value),
        totalFactura: Number(cellNumber(row.getCell(26).value) || 0),
        baseImponible: Number(cellNumber(row.getCell(27).value) || 0),
        tipoIva: Number(cellNumber(row.getCell(28).value) || 0),
        cuotaIva: Number(cellNumber(row.getCell(29).value) || 0),
        cuotaDeducible: Number(cellNumber(row.getCell(30).value) || 0),
        tipoRecargo: cellNumber(row.getCell(31).value),
        cuotaRecargo: cellNumber(row.getCell(32).value),
        tipoRetencion: cellNumber(row.getCell(37).value),
        importeRetenido: cellNumber(row.getCell(38).value),
        referenciaExterna: cellText(row.getCell(42).value),
      })
    }
  }

  return { sheetNames, books: { issued, received } }
}
