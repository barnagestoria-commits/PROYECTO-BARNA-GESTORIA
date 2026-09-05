import type { FiscalPeriodKey } from "@/lib/types/fiscal-panorama"
import {
  calculateModelAmount,
  type RawEntryLine,
} from "@/lib/fiscal/panorama"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface TaxSummaryBreakdown {
  ivaResult: number
  retenciones111: number
  retenciones115: number
  retenciones123: number
  pagos130: number
  retenciones180: number
  totalAPagarDevolver: number
  label: string
}

export type TaxSummaryAmountOverrides = Partial<
  Record<"111" | "115" | "123" | "130" | "180" | "303", number>
>

export function calculateTaxSummary(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
  overrides: TaxSummaryAmountOverrides = {},
): TaxSummaryBreakdown {
  const iva = calculateModelAmount("303", lines, year, quarter)
  const m111 = calculateModelAmount("111", lines, year, quarter)
  const m115 = calculateModelAmount("115", lines, year, quarter)
  const m123 = calculateModelAmount("123", lines, year, quarter)
  const m130 = calculateModelAmount("130", lines, year, quarter)
  const m180 =
    quarter === "annual"
      ? calculateModelAmount("180", lines, year, "annual")
      : { amount: 0, lineCount: 0, entryIds: new Set(), breakdown: [] }

  const ivaResult = overrides["303"] ?? iva.amount
  const retenciones111 = overrides["111"] ?? m111.amount
  const retenciones115 = overrides["115"] ?? m115.amount
  const retenciones123 = overrides["123"] ?? m123.amount
  const pagos130 = overrides["130"] ?? m130.amount
  const retenciones180 = overrides["180"] ?? m180.amount

  const retencionesTotal = round2(
    retenciones111 + retenciones115 + retenciones123 + pagos130 + retenciones180,
  )
  const ivaAPagar = ivaResult > 0 ? ivaResult : 0
  const totalAPagarDevolver = round2(retencionesTotal + ivaAPagar)

  const label =
    totalAPagarDevolver > 0
      ? "A ingresar"
      : totalAPagarDevolver < 0
        ? "A compensar / devolver"
        : "Sin resultado"

  return {
    ivaResult,
    retenciones111,
    retenciones115,
    retenciones123,
    pagos130,
    retenciones180,
    totalAPagarDevolver,
    label,
  }
}

export function periodKeyToQuarter(period: FiscalPeriodKey): 1 | 2 | 3 | 4 | "annual" {
  if (period === "annual") return "annual"
  return Number(period.replace("q", "")) as 1 | 2 | 3 | 4
}
