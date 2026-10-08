import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { resolveMovementDocumentNumber } from "@/lib/accounting/account-movements-service"
import {
  entryMatchesSearch,
  parseEntrySearchQuery,
  type ParsedEntrySearch,
} from "@/lib/accounting/entry-search"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export async function getNextEntryRefNumber(
  companyId: string,
  tx?: Pick<typeof prisma, "accountingEntry">,
): Promise<number> {
  const client = tx ?? prisma
  const result = await client.accountingEntry.aggregate({
    where: { companyId },
    _max: { refNumber: true },
  })
  return (result._max.refNumber ?? 0) + 1
}

export interface EntryRefSummary {
  id: string
  refNumber: number
  fecha: string
  commandCode: string | null
  documento: string | null
  concepto: string | null
  cuentas: string | null
  totalDebe: number
}

export const LAST_ENTRIES_LIMIT = 8

export async function searchEntriesByRef(params: {
  companyId: string
  fromRef?: number
  toRef?: number
  query?: string
  last?: boolean
  limit?: number
}): Promise<{ entries: EntryRefSummary[]; nextRefNumber: number }> {
  const nextRefNumber = await getNextEntryRefNumber(params.companyId)
  const criteria = params.query ? parseEntrySearchQuery(params.query) : null

  if (params.last && !criteria) {
    const entries = await prisma.accountingEntry.findMany({
      where: { companyId: params.companyId },
      orderBy: { refNumber: "desc" },
      take: params.limit ?? LAST_ENTRIES_LIMIT,
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
      },
    })

    return {
      entries: entries.map(mapEntryRefSummary),
      nextRefNumber: entries.length === 0 ? 1 : nextRefNumber,
    }
  }

  const refRange =
    params.fromRef != null || params.toRef != null
      ? {
          refNumber: {
            gte: params.fromRef ?? 1,
            lte: params.toRef ?? params.fromRef ?? 1,
          },
        }
      : {}

  if (!criteria) {
    const fromRef = params.fromRef ?? 1
    const toRef = params.toRef ?? fromRef
    const entries = await prisma.accountingEntry.findMany({
      where: {
        companyId: params.companyId,
        refNumber: { gte: fromRef, lte: toRef },
      },
      orderBy: { refNumber: "asc" },
      take: params.limit ?? 50,
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
      },
    })

    return {
      entries: entries.map(mapEntryRefSummary),
      nextRefNumber,
    }
  }

  const amountIds = criteria.amount != null
    ? await entryIdsWithTotal(params.companyId, criteria.amount, params.fromRef, params.toRef)
    : []

  const entries = await prisma.accountingEntry.findMany({
    where: {
      companyId: params.companyId,
      ...refRange,
      OR: buildEntrySearchOr(criteria, amountIds),
    },
    orderBy: { refNumber: "desc" },
    take: params.limit ?? 50,
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
    },
  })

  const matched = entries.filter((entry) =>
    entryMatchesSearch(
      {
        refNumber: entry.refNumber,
        fecha: entry.fecha.toISOString().split("T")[0],
        commandCode: entry.commandCode,
        invoiceNumber: entry.invoiceNumber,
        invoiceDataJson: entry.invoiceDataJson,
        lines: entry.lines.map((line) => ({
          cuenta: line.cuenta,
          concepto: line.concepto,
          debe: decimalToNumber(line.debe),
          haber: decimalToNumber(line.haber),
        })),
      },
      criteria,
    ),
  )

  return {
    entries: matched.map(mapEntryRefSummary),
    nextRefNumber,
  }
}

function buildEntrySearchOr(
  criteria: ParsedEntrySearch,
  amountEntryIds: string[],
): Prisma.AccountingEntryWhereInput[] {
  const or: Prisma.AccountingEntryWhereInput[] = [
    { invoiceNumber: { contains: criteria.text, mode: "insensitive" } },
    { commandCode: { contains: criteria.text, mode: "insensitive" } },
    { invoiceDataJson: { contains: criteria.text, mode: "insensitive" } },
    { lines: { some: { concepto: { contains: criteria.text, mode: "insensitive" } } } },
    { lines: { some: { cuenta: { contains: criteria.text, mode: "insensitive" } } } },
  ]

  if (criteria.refNumber != null) {
    or.push({ refNumber: criteria.refNumber })
  }

  if (criteria.date) {
    or.push({ fecha: new Date(`${criteria.date}T00:00:00.000Z`) })
  }

  if (criteria.accountDigits) {
    or.push({ lines: { some: { cuenta: { contains: criteria.accountDigits } } } })
    const formatted = formatAccountCodeDisplay(criteria.accountDigits)
    if (formatted && formatted !== criteria.text) {
      or.push({ lines: { some: { cuenta: { contains: formatted, mode: "insensitive" } } } })
    }
  }

  if (criteria.amount != null) {
    const amount = new Prisma.Decimal(criteria.amount.toFixed(2))
    or.push({ lines: { some: { debe: amount } } })
    or.push({ lines: { some: { haber: amount } } })
    if (amountEntryIds.length > 0) {
      or.push({ id: { in: amountEntryIds } })
    }
  }

  return or
}

async function entryIdsWithTotal(
  companyId: string,
  amount: number,
  fromRef?: number,
  toRef?: number,
): Promise<string[]> {
  const grouped = await prisma.entryLine.groupBy({
    by: ["entryId"],
    where: {
      entry: {
        companyId,
        ...(fromRef != null || toRef != null
          ? { refNumber: { gte: fromRef ?? 1, lte: toRef ?? fromRef ?? 1 } }
          : {}),
      },
    },
    _sum: { debe: true },
    having: {
      debe: { _sum: { equals: new Prisma.Decimal(amount.toFixed(2)) } },
    },
  })

  return grouped.map((row) => row.entryId)
}

export async function getEntryByRefNumber(
  companyId: string,
  refNumber: number,
): Promise<string | null> {
  const entry = await prisma.accountingEntry.findUnique({
    where: {
      companyId_refNumber: { companyId, refNumber },
    },
    select: { id: true },
  })
  return entry?.id ?? null
}

function mapEntryRefSummary(entry: {
  id: string
  refNumber: number
  fecha: Date
  commandCode: string | null
  invoiceNumber: string | null
  invoiceDataJson: string | null
  lines: Array<{ cuenta: string; concepto: string; debe: Prisma.Decimal | number | string; haber: Prisma.Decimal | number | string }>
}): EntryRefSummary {
  const totalDebe = entry.lines.reduce((sum, line) => sum + decimalToNumber(line.debe), 0)
  const cuentas = [...new Set(entry.lines.map((line) => formatAccountCodeDisplay(line.cuenta)).filter(Boolean))]
  return {
    id: entry.id,
    refNumber: entry.refNumber,
    fecha: entry.fecha.toISOString().split("T")[0],
    commandCode: entry.commandCode,
    documento: resolveMovementDocumentNumber({
      invoiceNumber: entry.invoiceNumber,
      invoiceDataJson: entry.invoiceDataJson,
      commandCode: entry.commandCode,
      concepts: entry.lines.map((line) => line.concepto),
    }),
    concepto: entry.lines.find((line) => line.concepto.trim())?.concepto ?? null,
    cuentas: cuentas.length > 0 ? cuentas.join(" · ") : null,
    totalDebe: Math.round(totalDebe * 100) / 100,
  }
}

export function formatEntryRefLabel(refNumber: number, commandCode?: string | null): string {
  const suffix = commandCode ? ` · ${commandCode}` : ""
  return `Asiento ${refNumber}${suffix}`
}
