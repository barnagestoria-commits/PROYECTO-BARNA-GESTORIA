import { prisma } from "@/lib/db"
import { normalizeAccountCodeDigits } from "@/lib/accounting/account-treatment-types"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function decimalToNumber(value: unknown): number {
  return Number(value ?? 0)
}

function matchesPrefix(cuenta: string, prefix: string): boolean {
  const digits = normalizeAccountCodeDigits(cuenta)
  return digits.startsWith(prefix)
}

export interface VatLiquidationResult {
  year: number
  quarter: number
  saldoRepercutido: number
  saldoSoportado: number
  difference: number
  resultType: "pagar" | "compensar"
  settlementAccount: string
  settlementSide: "debe" | "haber"
  settlementAmount: number
  concept: string
}

export async function calculateVatLiquidation(params: {
  companyId: string
  year: number
  quarter: 1 | 2 | 3 | 4
}): Promise<VatLiquidationResult> {
  const ranges: Record<1 | 2 | 3 | 4, [string, string]> = {
    1: [`${params.year}-01-01`, `${params.year}-03-31`],
    2: [`${params.year}-04-01`, `${params.year}-06-30`],
    3: [`${params.year}-07-01`, `${params.year}-09-30`],
    4: [`${params.year}-10-01`, `${params.year}-12-31`],
  }

  const [startStr, endStr] = ranges[params.quarter]
  const start = new Date(`${startStr}T00:00:00.000Z`)
  const end = new Date(`${endStr}T23:59:59.999Z`)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId: params.companyId,
        fecha: { gte: start, lte: end },
      },
    },
    select: { cuenta: true, debe: true, haber: true },
  })

  let saldoRepercutido = 0
  let saldoSoportado = 0

  for (const line of lines) {
    const debe = decimalToNumber(line.debe)
    const haber = decimalToNumber(line.haber)

    if (matchesPrefix(line.cuenta, "477")) {
      saldoRepercutido += haber - debe
    }
    if (matchesPrefix(line.cuenta, "472")) {
      saldoSoportado += debe - haber
    }
  }

  saldoRepercutido = round2(saldoRepercutido)
  saldoSoportado = round2(saldoSoportado)
  const difference = round2(saldoRepercutido - saldoSoportado)

  const resultType = difference >= 0 ? "pagar" : "compensar"
  const settlementAccount = resultType === "pagar" ? "4750" : "4700"
  const settlementSide = resultType === "pagar" ? "haber" : "debe"
  const settlementAmount = round2(Math.abs(difference))

  return {
    year: params.year,
    quarter: params.quarter,
    saldoRepercutido,
    saldoSoportado,
    difference,
    resultType,
    settlementAccount,
    settlementSide,
    settlementAmount,
    concept: `Liquidación IVA T${params.quarter} ${params.year}`,
  }
}

export function buildVatLiquidationLines(liquidation: VatLiquidationResult) {
  const lines: Array<{ cuenta: string; concepto: string; debe: number; haber: number }> = []

  if (liquidation.saldoRepercutido > 0) {
    lines.push({
      cuenta: "477",
      concepto: liquidation.concept,
      debe: liquidation.saldoRepercutido,
      haber: 0,
    })
  }

  if (liquidation.saldoSoportado > 0) {
    lines.push({
      cuenta: "472",
      concepto: liquidation.concept,
      debe: 0,
      haber: liquidation.saldoSoportado,
    })
  }

  if (liquidation.settlementAmount > 0) {
    lines.push({
      cuenta: liquidation.settlementAccount,
      concepto: liquidation.concept,
      debe: liquidation.settlementSide === "debe" ? liquidation.settlementAmount : 0,
      haber: liquidation.settlementSide === "haber" ? liquidation.settlementAmount : 0,
    })
  }

  return lines
}
