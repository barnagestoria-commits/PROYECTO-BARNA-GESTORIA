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
  retenciones180: number
  totalAPagarDevolver: number
  label: string
}

export function calculateTaxSummary(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
): TaxSummaryBreakdown {
  const iva = calculateModelAmount("303", lines, year, quarter)
  const m111 = calculateModelAmount("111", lines, year, quarter)
  const m115 = calculateModelAmount("115", lines, year, quarter)
  const m180 =
    quarter === "annual"
      ? calculateModelAmount("180", lines, year, "annual")
      : { amount: 0, lineCount: 0, entryIds: new Set(), breakdown: [] }

  const ivaResult = iva.amount
  const retenciones111 = m111.amount
  const retenciones115 = m115.amount
  const retenciones180 = m180.amount

  const totalAPagarDevolver = round2(ivaResult + retenciones111 + retenciones115 + retenciones180)

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
    retenciones180,
    totalAPagarDevolver,
    label,
  }
}

export function periodKeyToQuarter(period: FiscalPeriodKey): 1 | 2 | 3 | 4 | "annual" {
  if (period === "annual") return "annual"
  return Number(period.replace("q", "")) as 1 | 2 | 3 | 4
}
