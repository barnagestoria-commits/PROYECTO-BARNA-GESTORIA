import { decimalToNumber } from "@/lib/prisma/decimal"
import {
  isDateInQuarter,
  isDateInYear,
  type RawEntryLine,
} from "@/lib/fiscal/panorama"

function filterLinesForPeriod(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): RawEntryLine[] {
  return lines.filter((line) => {
    const fecha = line.entry.fecha
    if (quarter === "annual") return isDateInYear(fecha, year)
    return isDateInQuarter(fecha, year, quarter)
  })
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function isIvaSoportadoBridgeLine(line: RawEntryLine): boolean {
  return /^IVA\s+S\./i.test(line.concepto.trim())
}

export function isIvaRepercutidoBridgeLine(line: RawEntryLine): boolean {
  return /^IVA\s+R\./i.test(line.concepto.trim())
}

export interface IvaBridgeSummary {
  soportado: number
  repercutido: number
  netResult: number
  soportadoLines: RawEntryLine[]
  repercutidoLines: RawEntryLine[]
  lineCount: number
}

export function calculateIvaBridgeSummary(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): IvaBridgeSummary {
  const periodLines = filterLinesForPeriod(lines, year, quarter)
  const soportadoLines = periodLines.filter(isIvaSoportadoBridgeLine)
  const repercutidoLines = periodLines.filter(isIvaRepercutidoBridgeLine)

  const soportado = round2(
    soportadoLines.reduce(
      (sum, line) => sum + decimalToNumber(line.debe) - decimalToNumber(line.haber),
      0,
    ),
  )
  const repercutido = round2(
    repercutidoLines.reduce(
      (sum, line) => sum + decimalToNumber(line.haber) - decimalToNumber(line.debe),
      0,
    ),
  )

  return {
    soportado,
    repercutido,
    netResult: round2(repercutido - soportado),
    soportadoLines,
    repercutidoLines,
    lineCount: soportadoLines.length + repercutidoLines.length,
  }
}
