import type { FiscalModelCode, FiscalDeclarationStatus, Prisma } from "@prisma/client"
import type {
  FiscalBlockId,
  FiscalCellStatus,
  FiscalModelId,
  FiscalPeriodKey,
} from "@/lib/types/fiscal-panorama"
import { decimalToNumber } from "@/lib/prisma/decimal"

export interface FiscalModelDefinition {
  code: FiscalModelId
  prismaCode: FiscalModelCode
  label: string
  description: string
  block: FiscalBlockId
}

export const FISCAL_MODEL_DEFINITIONS: FiscalModelDefinition[] = [
  {
    code: "111",
    prismaCode: "M111",
    label: "Modelo 111",
    description: "Retenciones IRPF — Trabajo y actividades profesionales",
    block: "IRPF",
  },
  {
    code: "115",
    prismaCode: "M115",
    label: "Modelo 115",
    description: "Retenciones IRPF — Arrendamientos de inmuebles urbanos",
    block: "IRPF",
  },
  {
    code: "180",
    prismaCode: "M180",
    label: "Modelo 180",
    description: "Resumen anual — Retenciones e ingresos a cuenta (alquileres 4751)",
    block: "IRPF",
  },
  {
    code: "303",
    prismaCode: "M303",
    label: "Modelo 303",
    description: "IVA — Autoliquidación (Repercutido − Soportado)",
    block: "IVA",
  },
]

export const FISCAL_MODEL_BY_CODE = Object.fromEntries(
  FISCAL_MODEL_DEFINITIONS.map((model) => [model.code, model]),
) as Record<FiscalModelId, FiscalModelDefinition>

export const FISCAL_PERIOD_KEYS: FiscalPeriodKey[] = ["q1", "q2", "q3", "q4", "annual"]

export interface RawEntryLine {
  id: string
  entryId: string
  cuenta: string
  concepto: string
  debe: Prisma.Decimal | number
  haber: Prisma.Decimal | number
  entry: {
    id: string
    fecha: Date
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeCuenta(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

export function matchesAccountPrefix(cuenta: string, prefixes: string[]): boolean {
  const digits = normalizeCuenta(cuenta)
  if (!digits) return false
  return prefixes.some((prefix) => digits.startsWith(prefix))
}

export function getQuarterFromDate(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getUTCMonth() + 1
  if (month <= 3) return 1
  if (month <= 6) return 2
  if (month <= 9) return 3
  return 4
}

export function periodKeyFromQuarter(quarter: 1 | 2 | 3 | 4): Exclude<FiscalPeriodKey, "annual"> {
  return `q${quarter}` as Exclude<FiscalPeriodKey, "annual">
}

export function quarterFromPeriodKey(period: FiscalPeriodKey): 1 | 2 | 3 | 4 | null {
  if (period === "annual") return null
  return Number(period.replace("q", "")) as 1 | 2 | 3 | 4
}

export function getQuarterDateRange(year: number, quarter: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const ranges: Record<1 | 2 | 3 | 4, [string, string]> = {
    1: [`${year}-01-01`, `${year}-03-31`],
    2: [`${year}-04-01`, `${year}-06-30`],
    3: [`${year}-07-01`, `${year}-09-30`],
    4: [`${year}-10-01`, `${year}-12-31`],
  }
  const [start, end] = ranges[quarter]
  return {
    start: new Date(`${start}T00:00:00.000Z`),
    end: new Date(`${end}T23:59:59.999Z`),
  }
}

export function isDateInQuarter(date: Date, year: number, quarter: 1 | 2 | 3 | 4): boolean {
  return getQuarterFromDate(date) === quarter && date.getUTCFullYear() === year
}

export function isDateInYear(date: Date, year: number): boolean {
  return date.getUTCFullYear() === year
}

function signedRetentionAmount(line: RawEntryLine): number {
  return round2(decimalToNumber(line.haber) - decimalToNumber(line.debe))
}

function signedRepercutidoAmount(line: RawEntryLine): number {
  return round2(decimalToNumber(line.haber) - decimalToNumber(line.debe))
}

function signedSoportadoAmount(line: RawEntryLine): number {
  return round2(decimalToNumber(line.debe) - decimalToNumber(line.haber))
}

export interface ModelAmountResult {
  amount: number
  lineCount: number
  entryIds: Set<string>
  breakdown: Array<{
    key: string
    label: string
    total: number
    lines: Array<{
      entryId: string
      entryDate: string
      lineId: string
      cuenta: string
      concepto: string
      debe: number
      haber: number
      signedAmount: number
    }>
  }>
}

function mapBreakdownLine(line: RawEntryLine, signedAmount: number, category?: string) {
  return {
    entryId: line.entry.id,
    entryDate: line.entry.fecha.toISOString().split("T")[0],
    lineId: line.id,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    signedAmount,
    category,
  }
}

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

export function calculateModelAmount(
  modelCode: FiscalModelId,
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): ModelAmountResult {
  const periodLines = filterLinesForPeriod(lines, year, quarter)
  const entryIds = new Set<string>()

  if (modelCode === "111") {
    const prefixes = ["4731"]
    const matched = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, prefixes))
    const breakdownLines = matched.map((line) => mapBreakdownLine(line, signedRetentionAmount(line)))
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(breakdownLines.reduce((sum, line) => sum + line.signedAmount, 0))
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [{ key: "retenciones", label: "Retenciones practicadas", total, lines: breakdownLines }],
    }
  }

  if (modelCode === "115") {
    const prefixes = ["4732"]
    const matched = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, prefixes))
    const breakdownLines = matched.map((line) => mapBreakdownLine(line, signedRetentionAmount(line)))
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(breakdownLines.reduce((sum, line) => sum + line.signedAmount, 0))
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [{ key: "retenciones", label: "Retenciones por arrendamientos", total, lines: breakdownLines }],
    }
  }

  if (modelCode === "180") {
    const prefixes = ["4751"]
    const matched = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, prefixes))
    const breakdownLines = matched.map((line) =>
      mapBreakdownLine(line, signedRetentionAmount(line), "alquiler"),
    )
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(breakdownLines.reduce((sum, line) => sum + line.signedAmount, 0))
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [
        {
          key: "retenciones-alquiler",
          label: "Retenciones alquileres — Hacienda acreedora (4751)",
          total,
          lines: breakdownLines,
        },
      ],
    }
  }

  const repercutidoLines = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, ["477"]))
  const soportadoLines = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, ["472"]))

  const repercutido = repercutidoLines.map((line) =>
    mapBreakdownLine(line, signedRepercutidoAmount(line), "repercutido"),
  )
  const soportado = soportadoLines.map((line) =>
    mapBreakdownLine(line, signedSoportadoAmount(line), "soportado"),
  )

  for (const line of [...repercutidoLines, ...soportadoLines]) entryIds.add(line.entry.id)

  const totalRepercutido = round2(repercutido.reduce((sum, line) => sum + line.signedAmount, 0))
  const totalSoportado = round2(soportado.reduce((sum, line) => sum + line.signedAmount, 0))
  const amount = round2(totalRepercutido - totalSoportado)

  return {
    amount,
    lineCount: repercutido.length + soportado.length,
    entryIds,
    breakdown: [
      { key: "repercutido", label: "IVA repercutido (477)", total: totalRepercutido, lines: repercutido },
      { key: "soportado", label: "IVA soportado (472)", total: totalSoportado, lines: soportado },
      { key: "resultado", label: "Resultado IVA (Repercutido − Soportado)", total: amount, lines: [] },
    ],
  }
}

export function resolveCellStatus(
  amount: number,
  lineCount: number,
  declarationStatus?: FiscalDeclarationStatus,
): { status: FiscalCellStatus; statusLabel: string } {
  if (declarationStatus === "PRESENTADO") {
    return { status: "presentado", statusLabel: "Presentado" }
  }

  if (lineCount === 0 && Math.abs(amount) < 0.01) {
    return { status: "sin_datos", statusLabel: "SD" }
  }

  return { status: "pendiente", statusLabel: "Pendiente" }
}

export function buildDetailHref(modelCode: FiscalModelId, year: number, period: FiscalPeriodKey): string {
  const quarter = period === "annual" ? "anual" : period.replace("q", "")
  return `/dashboard/fiscal/${modelCode}/${year}/${quarter}`
}

export function formatFiscalAmount(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    signDisplay: "exceptZero",
  }).format(amount)
}

export function periodLabel(period: FiscalPeriodKey, year: number): string {
  if (period === "annual") return `Resumen anual ${year}`
  const quarter = quarterFromPeriodKey(period)
  return `${quarter}T ${year}`
}

export function parseDetailQuarter(value: string): 1 | 2 | 3 | 4 | "annual" | null {
  if (value === "anual" || value === "annual") return "annual"
  const quarter = Number.parseInt(value, 10)
  if (quarter >= 1 && quarter <= 4) return quarter as 1 | 2 | 3 | 4
  return null
}

export function prismaCodeToModelId(code: FiscalModelCode): FiscalModelId {
  switch (code) {
    case "M111":
      return "111"
    case "M115":
      return "115"
    case "M180":
      return "180"
    case "M303":
      return "303"
  }
}
