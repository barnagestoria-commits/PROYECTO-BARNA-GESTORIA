import * as XLSX from "xlsx"
import type { BankMovementDraft, BankImportPreview } from "@/lib/bank-reconciliation/types"

const DATE_HEADERS = [
  "fecha",
  "date",
  "fecha operacion",
  "fecha operación",
  "fecha operaci",
  "fecha valor",
  "f. operacion",
  "f operacion",
  "f. valor",
]
const CONCEPT_HEADERS = [
  "concepto",
  "descripcion",
  "descripción",
  "detalle",
  "concept",
  "description",
  "movimiento",
  "observaciones",
]
const REFERENCE_HEADERS = ["referencia", "ref", "documento", "num operacion", "nº operación", "operation"]
const AMOUNT_HEADERS = ["importe", "amount", "cantidad", "monto", "saldo movimiento"]
const DEBIT_HEADERS = ["debe", "cargo", "debit", "gasto", "salida"]
const CREDIT_HEADERS = ["haber", "abono", "credit", "ingreso", "entrada"]
const BALANCE_HEADERS = ["saldo", "balance", "saldo contable"]
const SIGN_HEADERS = ["dh", "d/h", "tipo", "signo", "naturaleza"]

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function parseSpanishNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 100) / 100

  let text = String(raw).trim()
  if (!text) return null
  text = text.replace(/[€$\s]/g, "")

  const negative = text.startsWith("(") && text.endsWith(")")
  if (negative) text = text.slice(1, -1)

  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".")
    } else {
      text = text.replace(/,/g, "")
    }
  } else if (text.includes(",")) {
    text = text.replace(",", ".")
  }

  text = text.replace(/[^\d.-]/g, "")
  const parsed = Number.parseFloat(text)
  if (!Number.isFinite(parsed)) return null
  return Math.round((negative ? -parsed : parsed) * 100) / 100
}

function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null

  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw)
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0")
      const day = String(parsed.d).padStart(2, "0")
      return `${parsed.y}-${month}-${day}`
    }
  }

  const text = String(raw).trim()
  if (!text) return null

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  }

  const ymd = text.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? ""
  const semicolons = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return semicolons > commas ? ";" : ","
}

function rowsFromCsvText(text: string): unknown[][] {
  const delimiter = detectDelimiter(text)
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return lines.map((line) => {
    if (delimiter === ";") {
      return line.split(";").map((cell) => cell.trim().replace(/^"|"$/g, ""))
    }
    return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
  })
}

function rowsFromWorkbook(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]
}

function findHeaderRow(rows: unknown[][]): { headerIndex: number; columns: Record<string, number> } {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const columns: Record<string, number> = {}

    row.forEach((cell, colIndex) => {
      const header = normalizeHeader(cell)
      if (!header) return

      if (DATE_HEADERS.some((alias) => header.includes(alias)) && columns.date === undefined) {
        columns.date = colIndex
      }
      if (CONCEPT_HEADERS.some((alias) => header.includes(alias)) && columns.concept === undefined) {
        columns.concept = colIndex
      }
      if (REFERENCE_HEADERS.some((alias) => header.includes(alias)) && columns.reference === undefined) {
        columns.reference = colIndex
      }
      if (AMOUNT_HEADERS.some((alias) => header.includes(alias)) && columns.amount === undefined) {
        columns.amount = colIndex
      }
      if (DEBIT_HEADERS.some((alias) => header === alias || header.includes(alias)) && columns.debit === undefined) {
        columns.debit = colIndex
      }
      if (CREDIT_HEADERS.some((alias) => header === alias || header.includes(alias)) && columns.credit === undefined) {
        columns.credit = colIndex
      }
      if (BALANCE_HEADERS.some((alias) => header.includes(alias)) && columns.balance === undefined) {
        columns.balance = colIndex
      }
      if (SIGN_HEADERS.some((alias) => header === alias) && columns.sign === undefined) {
        columns.sign = colIndex
      }
    })

    const hasDate = columns.date !== undefined
    const hasAmount =
      columns.amount !== undefined || (columns.debit !== undefined && columns.credit !== undefined)

    if (hasDate && hasAmount) {
      return { headerIndex: rowIndex, columns }
    }
  }

  throw new Error(
    "No se detectaron columnas de extracto bancario. Usa fecha + importe, o fecha + cargo/abono (debe/haber).",
  )
}

function resolveAmount(row: unknown[], columns: Record<string, number>): number | null {
  if (columns.amount !== undefined) {
    let amount = parseSpanishNumber(row[columns.amount])
    if (amount === null) return null

    if (columns.sign !== undefined) {
      const sign = normalizeHeader(row[columns.sign])
      if (["d", "debe", "cargo", "debit", "-", "h", "gasto", "salida"].includes(sign)) {
        amount = -Math.abs(amount)
      } else if (["h", "haber", "abono", "credit", "+", "ingreso", "entrada"].includes(sign)) {
        amount = Math.abs(amount)
      }
    }

    return amount
  }

  const debit = columns.debit !== undefined ? parseSpanishNumber(row[columns.debit]) : null
  const credit = columns.credit !== undefined ? parseSpanishNumber(row[columns.credit]) : null

  if (debit && debit !== 0) return -Math.abs(debit)
  if (credit && credit !== 0) return Math.abs(credit)
  return null
}

function parseRows(rows: unknown[][], fileName: string, source: "CSV" | "XLSX"): BankImportPreview {
  const { headerIndex, columns } = findHeaderRow(rows)
  const movements: BankMovementDraft[] = []
  const warnings: string[] = []

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue

    const movementDate = parseDate(row[columns.date])
    const amount = resolveAmount(row, columns)

    if (!movementDate || amount === null || amount === 0) {
      warnings.push(`Fila ${rowIndex + 1}: omitida (fecha o importe no válidos).`)
      continue
    }

    const concept =
      columns.concept !== undefined ? String(row[columns.concept] ?? "").trim() : "Movimiento bancario"
    const reference =
      columns.reference !== undefined ? String(row[columns.reference] ?? "").trim() || undefined : undefined
    const balance =
      columns.balance !== undefined ? parseSpanishNumber(row[columns.balance]) ?? undefined : undefined

    movements.push({
      movementDate,
      concept: concept || "Movimiento bancario",
      reference,
      amount,
      balance,
    })
  }

  if (movements.length === 0) {
    throw new Error("No se encontraron movimientos bancarios válidos en el archivo.")
  }

  return { fileName, source, movements, warnings }
}

export function parseBankCsvBuffer(buffer: Buffer, fileName: string): BankImportPreview {
  const text = buffer.toString("utf8")
  const rows = rowsFromCsvText(text)
  return parseRows(rows, fileName, "CSV")
}

export function parseBankXlsxBuffer(buffer: Buffer, fileName: string): BankImportPreview {
  const rows = rowsFromWorkbook(buffer)
  return parseRows(rows, fileName, "XLSX")
}

export function parseBankSpreadsheetBuffer(buffer: Buffer, fileName: string): BankImportPreview {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseBankCsvBuffer(buffer, fileName)
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseBankXlsxBuffer(buffer, fileName)
  }
  throw new Error("Formato no soportado. Usa CSV o Excel (.xlsx).")
}
