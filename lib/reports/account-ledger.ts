import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import {
  cuentaSortKey,
  getAccountLevel,
  normalizeCuenta,
  round2,
} from "@/lib/reports/format"
import type { AccountBalance, ReportMeta } from "@/lib/reports/types"

export interface LedgerQuery {
  companyId: string
  year: number
  fromMonth?: number
  toMonth?: number
}

export function buildPeriodLabel(year: number, fromMonth?: number, toMonth?: number): string {
  if (!fromMonth && !toMonth) return `Ejercicio ${year}`
  const from = fromMonth ?? 1
  const to = toMonth ?? 12
  if (from === 1 && to === 12) return `Ejercicio ${year}`
  return `${from.toString().padStart(2, "0")}/${year} — ${to.toString().padStart(2, "0")}/${year}`
}

function buildDateRange(year: number, fromMonth?: number, toMonth?: number) {
  const from = fromMonth ?? 1
  const to = toMonth ?? 12
  const start = new Date(`${year}-${String(from).padStart(2, "0")}-01T00:00:00.000Z`)
  const endDay = new Date(year, to, 0).getDate()
  const end = new Date(`${year}-${String(to).padStart(2, "0")}-${String(endDay).padStart(2, "0")}T23:59:59.999Z`)
  return { start, end }
}

export async function fetchAccountBalances(query: LedgerQuery): Promise<AccountBalance[]> {
  const { start, end } = buildDateRange(query.year, query.fromMonth, query.toMonth)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId: query.companyId,
        fecha: { gte: start, lte: end },
      },
    },
    select: {
      cuenta: true,
      debe: true,
      haber: true,
    },
  })

  const map = new Map<string, { totalDebe: number; totalHaber: number }>()

  for (const line of lines) {
    const cuenta = normalizeCuenta(line.cuenta)
    if (!cuenta) continue

    const current = map.get(cuenta) ?? { totalDebe: 0, totalHaber: 0 }
    current.totalDebe += decimalToNumber(line.debe)
    current.totalHaber += decimalToNumber(line.haber)
    map.set(cuenta, current)
  }

  const balances: AccountBalance[] = Array.from(map.entries())
    .map(([cuenta, totals]) => ({
      cuenta,
      label: getAccountLabel(cuenta),
      totalDebe: round2(totals.totalDebe),
      totalHaber: round2(totals.totalHaber),
      saldo: round2(totals.totalDebe - totals.totalHaber),
      level: getAccountLevel(cuenta),
    }))
    .sort((a, b) => cuentaSortKey(a.cuenta).localeCompare(cuentaSortKey(b.cuenta)))

  return balances
}

export async function buildReportMeta(
  companyId: string,
  reportTitle: string,
  year: number,
  fromMonth?: number,
  toMonth?: number,
): Promise<ReportMeta> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, cif: true },
  })

  if (!company) {
    throw new Error("Empresa no encontrada.")
  }

  return {
    companyName: company.name,
    companyCif: company.cif,
    year,
    periodLabel: buildPeriodLabel(year, fromMonth, toMonth),
    reportTitle,
    generatedAt: new Date(),
  }
}
