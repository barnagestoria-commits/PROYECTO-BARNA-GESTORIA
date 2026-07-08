import * as XLSX from "xlsx"

export interface AccountingImportRow {
  fecha: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export type AccountingFileFormat = "csv" | "xlsx" | "xls"

export function detectAccountingFileFormat(fileName: string): AccountingFileFormat {
  const ext = fileName.toLowerCase().split(".").pop() ?? ""
  if (ext === "xlsx") return "xlsx"
  if (ext === "xls") return "xls"
  return "csv"
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
  }

  const raw = String(value ?? "").trim()
  if (!raw) return 0

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^\d.-]/g, "")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function normalizeFecha(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0]
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + value * 86_400_000)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split("T")[0]
    }
  }

  const raw = String(value ?? "").trim()
  if (!raw) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0")
    const month = slashMatch[2].padStart(2, "0")
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0]
  }

  return raw
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells.map((cell) => cell.replace(/^"|"$/g, ""))
}

function detectDelimiter(header: string): string {
  if (header.includes(";")) return ";"
  if (header.includes("\t")) return "\t"
  return ","
}

function findColumnIndex(headers: string[], matchers: string[]): number {
  return headers.findIndex((header) => matchers.some((matcher) => header.includes(matcher)))
}

function mapMatrixToRows(matrix: unknown[][]): AccountingImportRow[] {
  const normalizedMatrix = matrix
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))

  if (normalizedMatrix.length < 2) {
    throw new Error("El archivo debe incluir cabecera y al menos una línea de datos.")
  }

  const headers = normalizedMatrix[0].map((cell) => String(cell ?? "").trim().toLowerCase())
  const fechaIdx = findColumnIndex(headers, ["fecha", "date"])
  const cuentaIdx = findColumnIndex(headers, ["cuenta", "account", "codigo"])
  const conceptoIdx = findColumnIndex(headers, ["concepto", "descripcion", "description"])
  const debeIdx = findColumnIndex(headers, ["debe", "debit"])
  const haberIdx = findColumnIndex(headers, ["haber", "credit"])

  if (fechaIdx < 0 || cuentaIdx < 0 || debeIdx < 0 || haberIdx < 0) {
    throw new Error("Cabeceras requeridas: fecha, cuenta, debe y haber (concepto opcional).")
  }

  const rows: AccountingImportRow[] = []

  for (const row of normalizedMatrix.slice(1)) {
    const fecha = normalizeFecha(row[fechaIdx])
    const cuenta = String(row[cuentaIdx] ?? "").trim()
    if (!fecha || !cuenta) continue

    rows.push({
      fecha,
      cuenta,
      concepto: conceptoIdx >= 0 ? String(row[conceptoIdx] ?? "").trim() : "",
      debe: parseAmount(row[debeIdx]),
      haber: parseAmount(row[haberIdx]),
    })
  }

  if (rows.length === 0) {
    throw new Error("No se encontraron filas válidas en el archivo.")
  }

  return rows
}

export function parseAccountingCsvContent(content: string): AccountingImportRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error("El archivo debe incluir cabecera y al menos una línea de datos.")
  }

  const delimiter = detectDelimiter(lines[0])
  const matrix = lines.map((line) => parseCsvLine(line, delimiter))
  return mapMatrixToRows(matrix)
}

export function parseAccountingExcelBuffer(buffer: Buffer): AccountingImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("El archivo Excel no contiene hojas.")
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  }) as unknown[][]

  return mapMatrixToRows(matrix)
}

export function parseAccountingFile(buffer: Buffer, fileName: string): AccountingImportRow[] {
  const format = detectAccountingFileFormat(fileName)

  if (format === "csv") {
    const content = buffer.toString("utf-8")
    return parseAccountingCsvContent(content)
  }

  return parseAccountingExcelBuffer(buffer)
}
