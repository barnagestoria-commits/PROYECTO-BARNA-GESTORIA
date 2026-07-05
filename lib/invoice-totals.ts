import type { IvaDesgloseLine, InvoiceOcrResult, RecargoEquivalencia, TipoIva } from "@/lib/types/invoice"

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function parseTipoIva(value: unknown): TipoIva {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  if (parsed === 0 || parsed === 4 || parsed === 10 || parsed === 21) {
    return parsed
  }
  return 21
}

export function calculateCuotaIva(base: number, tipo: TipoIva): number {
  return round2(base * (tipo / 100))
}

export function sumDesglose(desglose: IvaDesgloseLine[]): { baseImponible: number; iva: number } {
  const baseImponible = round2(desglose.reduce((sum, line) => sum + line.base_imponible, 0))
  const iva = round2(desglose.reduce((sum, line) => sum + line.cuota_iva, 0))
  return { baseImponible, iva }
}

export function calculateTotalFromBreakdown(
  desglose: IvaDesgloseLine[],
  recargo: RecargoEquivalencia | null,
): number {
  const { baseImponible, iva } = sumDesglose(desglose)
  const recargoCuota = recargo?.cuota ?? 0
  return round2(baseImponible + iva + recargoCuota)
}

export function createEmptyDesgloseLine(tipo: TipoIva = 21): IvaDesgloseLine {
  return { base_imponible: 0, tipo_iva: tipo, cuota_iva: 0 }
}

export function syncInvoiceTotals(result: InvoiceOcrResult): InvoiceOcrResult {
  let desglose = result.iva_desglose.length > 0 ? [...result.iva_desglose] : [createEmptyDesgloseLine()]

  if (result.isSujetoPasivo) {
    desglose = desglose.map((line) => ({ ...line, cuota_iva: 0 }))
  }

  const recargo =
    result.isSujetoPasivo || result.isIntracomunitaria ? null : result.recargo_equivalencia

  const { baseImponible, iva } = sumDesglose(desglose)
  const total = calculateTotalFromBreakdown(desglose, recargo)

  return {
    ...result,
    iva_desglose: desglose,
    recargo_equivalencia: recargo,
    baseImponible,
    iva,
    total,
  }
}

export function totalsMatchBreakdown(result: InvoiceOcrResult, expectedTotal?: number): boolean {
  const calculated = calculateTotalFromBreakdown(result.iva_desglose, result.recargo_equivalencia)
  const target = expectedTotal ?? result.total
  return Math.abs(calculated - target) < 0.02
}
