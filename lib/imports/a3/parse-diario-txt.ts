import { formatA3Date, normalizeAccountCode, parseA3Amount } from "@/lib/imports/a3/fixed-record"
import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import type { A3JournalEntry, A3JournalLine } from "@/lib/imports/a3/types"

function normalizeFecha(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const a3 = formatA3Date(trimmed)
  if (a3) return a3

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0")
    const month = slashMatch[2].padStart(2, "0")
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    return `${year}-${month}-${day}`
  }

  return null
}

function parseDelimitedLine(line: string, headers: string[]): A3JournalLine | null {
  const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ","
  const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""))

  const idx = (aliases: string[]) =>
    headers.findIndex((header) => aliases.some((alias) => header.includes(alias)))

  const fechaIdx = idx(["fecha", "date", "f.contable", "f contable"])
  const cuentaIdx = idx(["cuenta", "account", "codigo", "código"])
  const conceptoIdx = idx(["concepto", "descripcion", "descripción", "title"])
  const debeIdx = idx(["debe", "debit", "importe debe"])
  const haberIdx = idx(["haber", "credit", "credito", "crédito", "importe haber"])
  const documentoIdx = idx(["documento", "doc", "asiento", "referencia"])

  if (fechaIdx < 0 || cuentaIdx < 0) return null

  const fecha = normalizeFecha(cells[fechaIdx] ?? "")
  const cuenta = normalizeAccountCode(cells[cuentaIdx] ?? "")
  if (!fecha || !cuenta) return null

  const debe = debeIdx >= 0 ? parseA3Amount(cells[debeIdx] ?? "") : 0
  const haber = haberIdx >= 0 ? parseA3Amount(cells[haberIdx] ?? "") : 0

  return {
    fecha,
    cuenta,
    concepto: conceptoIdx >= 0 ? cells[conceptoIdx] ?? "" : "",
    debe,
    haber,
    documento: documentoIdx >= 0 ? cells[documentoIdx] : undefined,
  }
}

function parseFixedWidthLine(line: string): A3JournalLine | null {
  const trimmed = line.trimEnd()
  if (trimmed.length < 30) return null

  const fechaRaw = trimmed.slice(0, 8)
  const fecha = normalizeFecha(fechaRaw)
  const cuenta = normalizeAccountCode(trimmed.slice(8, 20))
  if (!fecha || !cuenta) return null

  const concepto = trimmed.slice(20, 50).trim()
  const amountRaw = trimmed.slice(50, 64).trim()
  const dh = trimmed.slice(64, 65).toUpperCase()
  const importe = parseA3Amount(amountRaw)

  return {
    fecha,
    cuenta,
    concepto,
    debe: dh === "H" ? 0 : importe,
    haber: dh === "H" ? importe : 0,
  }
}

function groupLinesIntoEntries(lines: A3JournalLine[]): A3JournalEntry[] {
  const byAsiento = new Map<string, A3JournalEntry>()

  for (const line of lines) {
    const key = `${line.fecha}|${line.documento ?? ""}|${line.concepto}`
    const existing = byAsiento.get(key)
    if (existing) {
      existing.lines.push(line)
    } else {
      byAsiento.set(key, {
        fecha: line.fecha,
        documento: line.documento ?? "",
        concepto: line.concepto,
        lines: [line],
        recordTypes: ["0"],
      })
    }
  }

  return [...byAsiento.values()]
}

export function parseDiarioTxtContent(content: string): A3JournalEntry[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) return []

  const first = lines[0].toLowerCase()
  const hasHeader =
    first.includes("fecha") ||
    first.includes("date") ||
    first.includes("cuenta") ||
    first.includes("account")

  const parsedLines: A3JournalLine[] = []

  if (hasHeader) {
    const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ","
    const headers = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase())

    for (const line of lines.slice(1)) {
      const parsed = parseDelimitedLine(line, headers)
      if (parsed && (parsed.debe > 0 || parsed.haber > 0)) {
        parsedLines.push(parsed)
      }
    }
  } else {
    for (const line of lines) {
      const parsed =
        line.includes(";") || line.includes("\t") || line.includes(",")
          ? parseDelimitedLine(line, ["fecha", "cuenta", "concepto", "debe", "haber"])
          : parseFixedWidthLine(line)
      if (parsed && (parsed.debe > 0 || parsed.haber > 0)) {
        parsedLines.push(parsed)
      }
    }
  }

  return groupLinesIntoEntries(parsedLines)
}

export function parseDiarioTxtBuffer(buffer: ImportBytes): A3JournalEntry[] {
  return parseDiarioTxtContent(decodeLatin1(buffer))
}
