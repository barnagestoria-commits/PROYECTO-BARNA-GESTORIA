import { prisma } from "@/lib/db"

interface CsvRow {
  fecha: string
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

function parseCsvLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""))
}

function detectDelimiter(header: string): string {
  if (header.includes(";")) return ";"
  if (header.includes("\t")) return "\t"
  return ","
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export function parseAccountingCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error("El archivo debe incluir cabecera y al menos una línea de datos.")
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase())

  const fechaIdx = headers.findIndex((h) => h.includes("fecha"))
  const cuentaIdx = headers.findIndex((h) => h.includes("cuenta"))
  const conceptoIdx = headers.findIndex((h) => h.includes("concepto"))
  const debeIdx = headers.findIndex((h) => h === "debe")
  const haberIdx = headers.findIndex((h) => h === "haber")

  if (fechaIdx < 0 || cuentaIdx < 0 || debeIdx < 0 || haberIdx < 0) {
    throw new Error("Cabeceras requeridas: fecha, cuenta, concepto, debe, haber.")
  }

  const rows: CsvRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line, delimiter)
    const fecha = cells[fechaIdx]
    const cuenta = cells[cuentaIdx]
    if (!fecha || !cuenta) continue

    rows.push({
      fecha,
      cuenta,
      concepto: conceptoIdx >= 0 ? cells[conceptoIdx] ?? "" : "",
      debe: parseAmount(cells[debeIdx] ?? "0"),
      haber: parseAmount(cells[haberIdx] ?? "0"),
    })
  }

  if (rows.length === 0) {
    throw new Error("No se encontraron filas válidas en el archivo.")
  }

  return rows
}

function groupRowsByDate(rows: CsvRow[]): Map<string, CsvRow[]> {
  const groups = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.fecha) ?? []
    existing.push(row)
    groups.set(row.fecha, existing)
  }
  return groups
}

export async function importAccountingCsv(
  companyId: string,
  fileName: string,
  content: string,
  uploadedById?: string,
) {
  const importRecord = await prisma.accountingDataImport.create({
    data: {
      companyId,
      fileName,
      format: fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
      status: "PENDIENTE",
      uploadedById,
    },
  })

  try {
    const rows = parseAccountingCsv(content)
    const groups = groupRowsByDate(rows)
    let entriesCreated = 0

    for (const [fecha, groupRows] of groups) {
      const date = new Date(`${fecha}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime())) continue

      await prisma.accountingEntry.create({
        data: {
          companyId,
          fecha: date,
          commandCode: null,
          createdById: uploadedById,
          lines: {
            create: groupRows.map((row, index) => ({
              sortOrder: index,
              cuenta: row.cuenta,
              concepto: row.concepto,
              debe: row.debe,
              haber: row.haber,
            })),
          },
        },
      })
      entriesCreated += 1
    }

    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: { status: "PROCESADO", rowsImported: rows.length },
    })

    return { id: importRecord.id, fileName, rowsImported: rows.length, status: "PROCESADO", entriesCreated }
  } catch (error) {
    await prisma.accountingDataImport.update({
      where: { id: importRecord.id },
      data: {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Error al importar.",
      },
    })
    throw error
  }
}
