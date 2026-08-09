import type { FiscalModelCode, FiscalDeclarationStatus, Prisma } from "@prisma/client"
import type {
  FiscalBlockId,
  FiscalCellStatus,
  FiscalModelId,
  FiscalPeriodKey,
} from "@/lib/types/fiscal-panorama"
import { decimalToNumber } from "@/lib/prisma/decimal"
import {
  collectEntryLines,
  extractGenericModelLiquidationDetail,
  extractModel111LiquidationDetail,
  extractModel111NrcAccrualLines,
  extractModel111NrcPaymentDetail,
  extractModel303LiquidationDetail,
  isIntracomunitariaLine,
  isModel111RetentionLine,
  isModel115RentalRetentionLine,
  isModel123DividendRetentionLine,
  liquidationSignedAmount,
} from "@/lib/fiscal/fiscal-line-detection"
import { calculateIvaBridgeSummary } from "@/lib/fiscal/iva-bridge-summary"

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
    code: "123",
    prismaCode: "M123",
    label: "Modelo 123",
    description: "Retenciones e ingresos a cuenta — Dividendos y capital mobiliario",
    block: "IRPF",
  },
  {
    code: "349",
    prismaCode: "M349",
    label: "Modelo 349",
    description: "IVA — Declaración recapitulativa de operaciones intracomunitarias",
    block: "IVA",
  },
  {
    code: "303",
    prismaCode: "M303",
    label: "Modelo 303",
    description: "IVA — Autoliquidación (Repercutido − Soportado)",
    block: "IVA",
  },
  {
    code: "180",
    prismaCode: "M180",
    label: "Modelo 180",
    description: "Resumen anual — Retenciones e ingresos a cuenta (alquileres 4751)",
    block: "IRPF",
  },
  {
    code: "190",
    prismaCode: "M190",
    label: "Modelo 190",
    description: "Resumen anual — Retenciones e ingresos a cuenta (Imp. Sociedades / IRPF)",
    block: "IRPF",
  },
  {
    code: "347",
    prismaCode: "M347",
    label: "Modelo 347",
    description: "Declaración anual — Operaciones con terceras personas",
    block: "INFORMATIVAS",
  },
  {
    code: "390",
    prismaCode: "M390",
    label: "Modelo 390",
    description: "Resumen anual — IVA",
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
    concepto?: string | null
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
    entryConcept: line.entry.concepto ?? undefined,
    lineId: line.id,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    signedAmount,
    category,
  }
}

function expandMatchedLinesToEntries(
  allLines: RawEntryLine[],
  matchedLines: RawEntryLine[],
  signedAmountForLine: (line: RawEntryLine) => number,
) {
  const matchedIds = new Set(matchedLines.map((line) => line.id))
  const entryIds = [...new Set(matchedLines.map((line) => line.entry.id))].sort()

  return entryIds.flatMap((entryId) => {
    const entryLines = collectEntryLines(allLines, entryId)
    return entryLines.map((line) =>
      mapBreakdownLine(
        line,
        matchedIds.has(line.id) ? signedAmountForLine(line) : 0,
        matchedIds.has(line.id) ? "contributing" : "asiento",
      ),
    )
  })
}

function expandLiquidationEntry(
  allLines: RawEntryLine[],
  entryId: string,
  contributingLineId: string,
) {
  return collectEntryLines(allLines, entryId).map((line) =>
    mapBreakdownLine(line, liquidationSignedAmount(line, contributingLineId), line.id === contributingLineId ? "contributing" : "asiento"),
  )
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
    if (quarter !== "annual") {
      const liquidation = extractModel111LiquidationDetail(lines, year, quarter)
      if (liquidation) {
        const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
        for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
        return {
          amount: liquidation.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "liquidacion",
              label: `Liquidación Modelo 111 (${quarter}T)`,
              total: liquidation.amount,
              lines: breakdownLines,
            },
          ],
        }
      }

      const nrcPayment = extractModel111NrcPaymentDetail(lines, year, quarter)
      if (nrcPayment) {
        const breakdownLines = expandLiquidationEntry(lines, nrcPayment.entryId, nrcPayment.contributingLineId)
        for (const line of collectEntryLines(lines, nrcPayment.entryId)) entryIds.add(line.entry.id)
        return {
          amount: nrcPayment.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "nrc-pago",
              label: `Pago NRC Modelo 111 (${quarter}T)`,
              total: nrcPayment.amount,
              lines: breakdownLines,
            },
          ],
        }
      }

      const nrcAccrualLines = extractModel111NrcAccrualLines(lines, year, quarter)
      if (nrcAccrualLines.length > 0) {
        const breakdownLines = expandMatchedLinesToEntries(lines, nrcAccrualLines, (line) =>
          round2(decimalToNumber(line.debe)),
        )
        for (const line of nrcAccrualLines) entryIds.add(line.entry.id)
        const total = round2(
          breakdownLines
            .filter((line) => line.category === "contributing")
            .reduce((sum, line) => sum + line.signedAmount, 0),
        )
        return {
          amount: total,
          lineCount: nrcAccrualLines.length,
          entryIds,
          breakdown: [{ key: "nrc-accrual", label: "Ingreso NRC Modelo 111", total, lines: breakdownLines }],
        }
      }
    }

    const matched = periodLines.filter(isModel111RetentionLine)
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, signedRetentionAmount)
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [{ key: "retenciones", label: "Retenciones practicadas", total, lines: breakdownLines }],
    }
  }

  if (modelCode === "123") {
    const matched = periodLines.filter(isModel123DividendRetentionLine)
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, signedRetentionAmount)
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [
        {
          key: "retenciones-dividendos",
          label: "Retenciones sobre dividendos",
          total,
          lines: breakdownLines,
        },
      ],
    }
  }

  if (modelCode === "115") {
    const matched = periodLines.filter(isModel115RentalRetentionLine)
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, signedRetentionAmount)
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
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
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, signedRetentionAmount)
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
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

  if (modelCode === "190") {
    if (quarter === "annual") {
      const liquidation = extractGenericModelLiquidationDetail(lines, year, "annual", "190")
      if (liquidation) {
        const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
        for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
        return {
          amount: liquidation.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "liquidacion",
              label: "Liquidación Modelo 190",
              total: liquidation.amount,
              lines: breakdownLines,
            },
          ],
        }
      }
    }

    const matched = periodLines.filter(
      (line) =>
        isModel111RetentionLine(line) ||
        isModel115RentalRetentionLine(line) ||
        isModel123DividendRetentionLine(line),
    )
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, signedRetentionAmount)
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [
        {
          key: "retenciones-anuales",
          label: "Retenciones practicadas acumuladas (111/115/123)",
          total,
          lines: breakdownLines,
        },
      ],
    }
  }

  if (modelCode === "347") {
    const liquidation = extractGenericModelLiquidationDetail(lines, year, quarter, "347")
    if (liquidation) {
      const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
      for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
      return {
        amount: liquidation.amount,
        lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
        entryIds,
        breakdown: [
          {
            key: "liquidacion",
            label: "Liquidación Modelo 347",
            total: liquidation.amount,
            lines: breakdownLines,
          },
        ],
      }
    }

    const matched = periodLines.filter((line) => {
      const text = `${line.concepto} ${line.entry.concepto ?? ""}`
      return /Modelo\s+347|347.*tercer|OPERAC.*TERCER/i.test(text)
    })
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, (line) =>
      round2(Math.max(decimalToNumber(line.debe), decimalToNumber(line.haber))),
    )
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [
        {
          key: "operaciones-terceros",
          label: "Operaciones declarables — terceros",
          total,
          lines: breakdownLines,
        },
      ],
    }
  }

  if (modelCode === "349") {
    if (quarter !== "annual") {
      const liquidation = extractGenericModelLiquidationDetail(lines, year, quarter, "349")
      if (liquidation) {
        const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
        for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
        return {
          amount: liquidation.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "liquidacion",
              label: `Liquidación Modelo 349 (${quarter}T)`,
              total: liquidation.amount,
              lines: breakdownLines,
            },
          ],
        }
      }
    }

    const matched = periodLines.filter(isIntracomunitariaLine)
    const breakdownLines = expandMatchedLinesToEntries(lines, matched, (line) => {
      const debe = decimalToNumber(line.debe)
      const haber = decimalToNumber(line.haber)
      return round2(Math.max(debe, haber))
    })
    for (const line of matched) entryIds.add(line.entry.id)
    const total = round2(
      breakdownLines
        .filter((line) => line.category === "contributing")
        .reduce((sum, line) => sum + line.signedAmount, 0),
    )
    return {
      amount: total,
      lineCount: matched.length,
      entryIds,
      breakdown: [
        {
          key: "intracomunitarias",
          label: "Operaciones intracomunitarias",
          total,
          lines: breakdownLines,
        },
      ],
    }
  }

  if (modelCode === "390") {
    if (quarter === "annual") {
      const liquidation = extractGenericModelLiquidationDetail(lines, year, "annual", "390")
      if (liquidation) {
        const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
        for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
        return {
          amount: liquidation.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "liquidacion",
              label: "Liquidación Modelo 390",
              total: liquidation.amount,
              lines: breakdownLines,
            },
          ],
        }
      }

      const quarterly303 = ([1, 2, 3, 4] as const).map((q) => calculateModelAmount("303", lines, year, q).amount)
      const total = round2(quarterly303.reduce((sum, value) => sum + value, 0))
      return {
        amount: total,
        lineCount: quarterly303.filter((value) => Math.abs(value) >= 0.01).length,
        entryIds,
        breakdown: [
          {
            key: "resumen-iva",
            label: "Resumen anual IVA (suma trimestral del 303)",
            total,
            lines: [],
          },
        ],
      }
    }

    return {
      amount: 0,
      lineCount: 0,
      entryIds,
      breakdown: [],
    }
  }

  if (modelCode === "303") {
    if (quarter !== "annual") {
      const liquidation = extractModel303LiquidationDetail(lines, year, quarter)
      if (liquidation) {
        const breakdownLines = expandLiquidationEntry(lines, liquidation.entryId, liquidation.contributingLineId)
        for (const line of collectEntryLines(lines, liquidation.entryId)) entryIds.add(line.entry.id)
        return {
          amount: liquidation.amount,
          lineCount: breakdownLines.filter((line) => line.category === "contributing").length,
          entryIds,
          breakdown: [
            {
              key: "liquidacion",
              label: `Liquidación Modelo 303 (${quarter}T)`,
              total: liquidation.amount,
              lines: breakdownLines,
            },
          ],
        }
      }

      const bridge = calculateIvaBridgeSummary(lines, year, quarter)
      if (bridge.lineCount > 0) {
        for (const line of [...bridge.soportadoLines, ...bridge.repercutidoLines]) {
          entryIds.add(line.entry.id)
        }
        const soportado = expandMatchedLinesToEntries(lines, bridge.soportadoLines, (line) =>
          round2(decimalToNumber(line.debe) - decimalToNumber(line.haber)),
        )
        const repercutido = expandMatchedLinesToEntries(lines, bridge.repercutidoLines, (line) =>
          round2(decimalToNumber(line.haber) - decimalToNumber(line.debe)),
        )
        return {
          amount: bridge.netResult,
          lineCount: bridge.lineCount,
          entryIds,
          breakdown: [
            { key: "repercutido", label: "IVA repercutido (IVA R./)", total: bridge.repercutido, lines: repercutido },
            { key: "soportado", label: "IVA soportado (IVA S./)", total: bridge.soportado, lines: soportado },
            {
              key: "resultado",
              label: "Resultado IVA estimado (Repercutido − Soportado)",
              total: bridge.netResult,
              lines: [],
            },
          ],
        }
      }
    }

    const repercutidoLines = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, ["477"]))
    const soportadoLines = periodLines.filter((line) => matchesAccountPrefix(line.cuenta, ["472"]))

    const repercutido = expandMatchedLinesToEntries(lines, repercutidoLines, signedRepercutidoAmount)
    const soportado = expandMatchedLinesToEntries(lines, soportadoLines, signedSoportadoAmount)

    for (const line of [...repercutidoLines, ...soportadoLines]) entryIds.add(line.entry.id)

    const totalRepercutido = round2(
      repercutido.filter((line) => line.category === "contributing").reduce((sum, line) => sum + line.signedAmount, 0),
    )
    const totalSoportado = round2(
      soportado.filter((line) => line.category === "contributing").reduce((sum, line) => sum + line.signedAmount, 0),
    )
    const amount = round2(totalRepercutido - totalSoportado)

    return {
      amount,
      lineCount: repercutidoLines.length + soportadoLines.length,
      entryIds,
      breakdown: [
        { key: "repercutido", label: "IVA repercutido (477)", total: totalRepercutido, lines: repercutido },
        { key: "soportado", label: "IVA soportado (472)", total: totalSoportado, lines: soportado },
        { key: "resultado", label: "Resultado IVA (Repercutido − Soportado)", total: amount, lines: [] },
      ],
    }
  }

  return {
    amount: 0,
    lineCount: 0,
    entryIds,
    breakdown: [],
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
    case "M123":
      return "123"
    case "M180":
      return "180"
    case "M190":
      return "190"
    case "M303":
      return "303"
    case "M347":
      return "347"
    case "M349":
      return "349"
    case "M390":
      return "390"
  }
}
