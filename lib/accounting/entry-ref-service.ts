import { prisma } from "@/lib/db"

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
  totalDebe: number
  concepto: string | null
}

export async function searchEntriesByRef(params: {
  companyId: string
  fromRef?: number
  toRef?: number
  last?: boolean
  limit?: number
}): Promise<{ entries: EntryRefSummary[]; nextRefNumber: number }> {
  const nextRefNumber = await getNextEntryRefNumber(params.companyId)

  if (params.last) {
    const entry = await prisma.accountingEntry.findFirst({
      where: { companyId: params.companyId },
      orderBy: { refNumber: "desc" },
      include: {
        lines: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    })

    if (!entry) {
      return { entries: [], nextRefNumber: 1 }
    }

    return {
      entries: [mapEntryRefSummary(entry)],
      nextRefNumber,
    }
  }

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
      lines: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  })

  return {
    entries: entries.map(mapEntryRefSummary),
    nextRefNumber,
  }
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
  lines: Array<{ concepto: string; debe: unknown; haber: unknown }>
}): EntryRefSummary {
  const totalDebe = entry.lines.reduce((sum, line) => sum + Number(line.debe), 0)
  return {
    id: entry.id,
    refNumber: entry.refNumber,
    fecha: entry.fecha.toISOString().split("T")[0],
    commandCode: entry.commandCode,
    totalDebe: Math.round(totalDebe * 100) / 100,
    concepto: entry.lines[0]?.concepto ?? null,
  }
}

export function formatEntryRefLabel(refNumber: number, commandCode?: string | null): string {
  const suffix = commandCode ? ` · ${commandCode}` : ""
  return `Asiento ${refNumber}${suffix}`
}
