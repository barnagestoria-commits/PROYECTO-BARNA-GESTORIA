import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { formatAccountNameDisplay, normalizeCuenta } from "@/lib/reports/format"
import {
  groupPunteoAccounts,
  type PunteoAccountOption,
  type PunteoWindow,
} from "@/lib/accounting/account-punteo"

export type { PunteoAccountOption }

export async function listPunteoAccounts(
  companyId: string,
  year: number,
  window: PunteoWindow,
): Promise<PunteoAccountOption[]> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year}-12-31T23:59:59.999Z`)

  const [lines, parties, ledgers] = await Promise.all([
    prisma.entryLine.findMany({
      where: {
        entry: {
          companyId,
          fecha: { gte: start, lte: end },
        },
      },
      select: {
        cuenta: true,
        punteado: true,
        debe: true,
        haber: true,
        entry: { select: { fecha: true } },
      },
    }),
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, name: true },
    }),
    prisma.ledgerSubaccount.findMany({
      where: { companyId },
      select: { accountCode: true, name: true },
    }),
  ])

  const names = new Map<string, string>()
  for (const row of ledgers) {
    const name = row.name.trim()
    if (name) names.set(normalizeCuenta(row.accountCode), name)
  }
  for (const row of parties) {
    const name = row.name.trim()
    if (name) names.set(normalizeCuenta(row.accountCode), name)
  }

  return groupPunteoAccounts(
    lines.map((line) => ({
      cuenta: line.cuenta,
      fecha: line.entry.fecha.toISOString().slice(0, 10),
      debe: decimalToNumber(line.debe),
      haber: decimalToNumber(line.haber),
      punteado: line.punteado,
    })),
    window,
  ).map((account) => ({
    ...account,
    formattedCuenta: formatAccountCodeDisplay(account.cuenta),
    label: formatAccountNameDisplay(names.get(account.cuenta) || getAccountLabel(account.cuenta)),
  }))
}

export async function setEntryLinesPunteado(
  companyId: string,
  lineIds: string[],
  punteado: boolean,
): Promise<{ updated: number }> {
  const unique = [...new Set(lineIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) {
    throw new Error("Selecciona al menos un apunte.")
  }
  if (unique.length > 500) {
    throw new Error("Puedes puntear hasta 500 apuntes a la vez.")
  }

  const found = await prisma.entryLine.findMany({
    where: {
      id: { in: unique },
      entry: { companyId },
    },
    select: { id: true },
  })

  if (found.length !== unique.length) {
    throw new Error("Algún apunte no pertenece a la empresa activa.")
  }

  await prisma.entryLine.updateMany({
    where: { id: { in: found.map((line) => line.id) } },
    data: {
      punteado,
      punteadoAt: punteado ? new Date() : null,
    },
  })

  return { updated: found.length }
}
