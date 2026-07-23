import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { normalizeCuenta, round2 } from "@/lib/reports/format"

export interface AccountMovementRow {
  id: string
  entryId: string
  refNumber: number
  fecha: string
  commandCode: string | null
  concepto: string
  contrapartida: string | null
  debe: number
  haber: number
  saldo: number
}

export interface AccountMovementsSummary {
  cuenta: string
  formattedCuenta: string
  label: string
  year: number
  openingBalance: number
  totalDebe: number
  totalHaber: number
  closingBalance: number
  movements: AccountMovementRow[]
}

function matchesCuenta(stored: string, target: string): boolean {
  return normalizeCuenta(stored) === normalizeCuenta(target)
}

export async function fetchAccountMovements(
  companyId: string,
  cuenta: string,
  year = new Date().getFullYear(),
): Promise<AccountMovementsSummary> {
  const normalized = normalizeCuenta(cuenta)
  if (normalized.length < 2) {
    throw new Error("Indica una cuenta contable válida para consultar movimientos.")
  }

  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year}-12-31T23:59:59.999Z`)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId,
        fecha: { gte: start, lte: end },
      },
    },
    include: {
      entry: {
        select: {
          id: true,
          refNumber: true,
          fecha: true,
          commandCode: true,
          lines: {
            select: { cuenta: true, concepto: true, debe: true, haber: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: [{ entry: { fecha: "asc" } }, { sortOrder: "asc" }],
  })

  const matched = lines.filter((line) => matchesCuenta(line.cuenta, normalized))

  let running = 0
  const movements: AccountMovementRow[] = matched.map((line) => {
    const debe = decimalToNumber(line.debe)
    const haber = decimalToNumber(line.haber)
    running = round2(running + debe - haber)

    const contrapartida =
      line.entry.lines.find((other) => !matchesCuenta(other.cuenta, normalized))?.cuenta ?? null

    return {
      id: line.id,
      entryId: line.entry.id,
      refNumber: line.entry.refNumber,
      fecha: line.entry.fecha.toISOString().split("T")[0],
      commandCode: line.entry.commandCode,
      concepto: line.concepto,
      contrapartida,
      debe,
      haber,
      saldo: running,
    }
  })

  const totalDebe = round2(movements.reduce((sum, row) => sum + row.debe, 0))
  const totalHaber = round2(movements.reduce((sum, row) => sum + row.haber, 0))

  return {
    cuenta: normalized,
    formattedCuenta: formatAccountCodeDisplay(normalized),
    label: getAccountLabel(normalized),
    year,
    openingBalance: 0,
    totalDebe,
    totalHaber,
    closingBalance: round2(totalDebe - totalHaber),
    movements,
  }
}
