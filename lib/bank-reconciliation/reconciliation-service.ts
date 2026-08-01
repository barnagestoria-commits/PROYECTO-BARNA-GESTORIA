import type { BankMovementStatus, Prisma } from "@prisma/client"
import type {
  BankMovementView,
  BankReconciliationSummary,
  ReconciliationCandidate,
} from "@/lib/bank-reconciliation/types"
import { prisma } from "@/lib/db"

const TREASURY_ACCOUNT_PREFIXES = ["572", "570"]

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === "number" ? value : Number(value)
}

function mapMovement(row: {
  id: string
  movementDate: Date
  valueDate: Date | null
  concept: string
  reference: string | null
  amount: Prisma.Decimal
  balance: Prisma.Decimal | null
  status: BankMovementStatus
  matchedEntryId: string | null
  matchedLineId: string | null
  matchedAt: Date | null
  matchedEntry: {
    refNumber: number
    lines: Array<{ id: string; cuenta: string; concepto: string }>
  } | null
  matchedLine: { cuenta: string; concepto: string } | null
  import: { fileName: string } | null
}): BankMovementView {
  let matchedCounterpartyCode: string | null = null
  if (row.matchedEntry && row.matchedLineId) {
    const other = row.matchedEntry.lines.find(
      (line) => line.id !== row.matchedLineId && !isTreasuryAccount(line.cuenta),
    )
    matchedCounterpartyCode = other?.cuenta ?? null
  }

  return {
    id: row.id,
    movementDate: row.movementDate.toISOString().slice(0, 10),
    valueDate: row.valueDate ? row.valueDate.toISOString().slice(0, 10) : null,
    concept: row.concept,
    reference: row.reference,
    amount: decimalToNumber(row.amount),
    balance: row.balance !== null ? decimalToNumber(row.balance) : null,
    status: row.status,
    importFileName: row.import?.fileName ?? null,
    matchedEntryId: row.matchedEntryId,
    matchedEntryRef: row.matchedEntry?.refNumber ?? null,
    matchedLineId: row.matchedLineId,
    matchedAccountCode: row.matchedLine?.cuenta ?? null,
    matchedCounterpartyCode,
    matchedConcept: row.matchedLine?.concepto ?? null,
    matchedAt: row.matchedAt?.toISOString() ?? null,
    accumulated: row.balance !== null ? decimalToNumber(row.balance) : null,
  }
}

function attachAccumulatedBalances(movements: BankMovementView[]): BankMovementView[] {
  const sorted = [...movements].sort((a, b) => {
    const dateCmp = a.movementDate.localeCompare(b.movementDate)
    if (dateCmp !== 0) return dateCmp
    return a.id.localeCompare(b.id)
  })

  let running = 0
  const accumulatedById = new Map<string, number>()

  for (const movement of sorted) {
    if (movement.balance !== null) {
      accumulatedById.set(movement.id, movement.balance)
    } else {
      running += movement.amount
      accumulatedById.set(movement.id, running)
    }
  }

  return movements.map((movement) => ({
    ...movement,
    accumulated: movement.accumulated ?? accumulatedById.get(movement.id) ?? null,
  }))
}

const movementInclude = {
  import: { select: { fileName: true } },
  matchedLine: { select: { cuenta: true, concepto: true } },
  matchedEntry: {
    select: {
      refNumber: true,
      lines: { select: { id: true, cuenta: true, concepto: true } },
    },
  },
}

function isTreasuryAccount(cuenta: string): boolean {
  const digits = cuenta.replace(/\D/g, "")
  return TREASURY_ACCOUNT_PREFIXES.some((prefix) => digits.startsWith(prefix))
}

export async function getBankReconciliationSummary(
  companyId: string,
): Promise<BankReconciliationSummary> {
  const [pending, reconciled, reviewed, ignored, total, balanceRows] = await Promise.all([
    prisma.bankMovement.aggregate({
      where: { companyId, status: "PENDIENTE" },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.bankMovement.count({ where: { companyId, status: "CONCILIADO" } }),
    prisma.bankMovement.count({ where: { companyId, status: "REVISADO" } }),
    prisma.bankMovement.count({ where: { companyId, status: "IGNORADO" } }),
    prisma.bankMovement.count({ where: { companyId } }),
    prisma.bankMovement.findMany({
      where: { companyId, balance: { not: null } },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
      select: { balance: true, amount: true, movementDate: true },
      take: 500,
    }),
  ])

  let openingBalance: number | null = null
  let closingBalance: number | null = null

  if (balanceRows.length > 0) {
    const first = balanceRows[0]!
    openingBalance = decimalToNumber(first.balance) - decimalToNumber(first.amount)
    closingBalance = decimalToNumber(balanceRows[balanceRows.length - 1]!.balance)
  }

  return {
    pendingCount: pending._count,
    reconciledCount: reconciled,
    reviewedCount: reviewed,
    ignoredCount: ignored,
    pendingAmount: decimalToNumber(pending._sum.amount),
    totalCount: total,
    openingBalance,
    closingBalance,
  }
}

export async function listBankMovements(
  companyId: string,
  status?: BankMovementStatus,
): Promise<BankMovementView[]> {
  const rows = await prisma.bankMovement.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
    },
    include: movementInclude,
    orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  })

  return attachAccumulatedBalances(rows.map(mapMovement))
}

async function getMatchedLineIds(companyId: string): Promise<Set<string>> {
  const rows = await prisma.bankMovement.findMany({
    where: { companyId, matchedLineId: { not: null } },
    select: { matchedLineId: true },
  })
  return new Set(rows.map((row) => row.matchedLineId!).filter(Boolean))
}

export async function findReconciliationCandidates(
  companyId: string,
  movementId: string,
): Promise<ReconciliationCandidate[]> {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId, status: "PENDIENTE" },
  })

  if (!movement) return []

  const amount = decimalToNumber(movement.amount)
  const absAmount = Math.abs(amount)
  const isInflow = amount > 0
  const matchedLineIds = await getMatchedLineIds(companyId)

  const dateFrom = new Date(movement.movementDate)
  dateFrom.setDate(dateFrom.getDate() - 45)
  const dateTo = new Date(movement.movementDate)
  dateTo.setDate(dateTo.getDate() + 15)

  const lines = await prisma.entryLine.findMany({
    where: {
      entry: {
        companyId,
        fecha: { gte: dateFrom, lte: dateTo },
      },
      ...(isInflow ? { debe: absAmount } : { haber: absAmount }),
    },
    include: {
      entry: {
        select: {
          id: true,
          refNumber: true,
          fecha: true,
        },
      },
    },
    take: 200,
  })

  const candidates: ReconciliationCandidate[] = []

  for (const line of lines) {
    if (!isTreasuryAccount(line.cuenta)) continue
    if (matchedLineIds.has(line.id)) continue

    const lineAmount = isInflow ? decimalToNumber(line.debe) : decimalToNumber(line.haber)
    if (Math.abs(lineAmount - absAmount) > 0.01) continue

    const entryDate = line.entry.fecha
    const dayDiff = Math.abs(
      (entryDate.getTime() - movement.movementDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    let score = 100
    score -= Math.min(dayDiff * 3, 60)

    const conceptMatch =
      movement.concept &&
      line.concepto &&
      line.concepto.toLowerCase().includes(movement.concept.slice(0, 12).toLowerCase())
    if (conceptMatch) score += 10

    candidates.push({
      entryLineId: line.id,
      entryId: line.entry.id,
      entryRef: line.entry.refNumber,
      entryDate: entryDate.toISOString().slice(0, 10),
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: decimalToNumber(line.debe),
      haber: decimalToNumber(line.haber),
      score,
      reason:
        dayDiff === 0
          ? "Importe y fecha coinciden"
          : `Importe coincide · ${Math.round(dayDiff)} días de diferencia`,
    })
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 8)
}

export async function matchBankMovement(
  companyId: string,
  movementId: string,
  entryLineId: string,
  userId?: string,
): Promise<BankMovementView> {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId, status: "PENDIENTE" },
  })
  if (!movement) throw new Error("Movimiento bancario no encontrado o ya conciliado.")

  const line = await prisma.entryLine.findFirst({
    where: {
      id: entryLineId,
      entry: { companyId },
    },
    include: { entry: true, bankMovement: true },
  })

  if (!line || !isTreasuryAccount(line.cuenta)) {
    throw new Error("Línea contable de tesorería no válida.")
  }

  if (line.bankMovement && line.bankMovement.id !== movementId) {
    throw new Error("Esa línea contable ya está conciliada con otro movimiento.")
  }

  const amount = decimalToNumber(movement.amount)
  const absAmount = Math.abs(amount)
  const lineAmount = amount > 0 ? decimalToNumber(line.debe) : decimalToNumber(line.haber)
  if (Math.abs(lineAmount - absAmount) > 0.01) {
    throw new Error("El importe del movimiento bancario no coincide con la línea contable.")
  }

  const updated = await prisma.bankMovement.update({
    where: { id: movementId },
    data: {
      status: "CONCILIADO",
      matchedEntryId: line.entry.id,
      matchedLineId: line.id,
      matchedAt: new Date(),
      matchedById: userId,
    },
    include: movementInclude,
  })

  return mapMovement(updated)
}

export async function unmatchBankMovement(
  companyId: string,
  movementId: string,
): Promise<BankMovementView> {
  const movement = await prisma.bankMovement.findFirst({
    where: {
      id: movementId,
      companyId,
      status: { in: ["CONCILIADO", "REVISADO"] },
    },
  })
  if (!movement) throw new Error("Movimiento conciliado no encontrado.")

  const updated = await prisma.bankMovement.update({
    where: { id: movementId },
    data: {
      status: "PENDIENTE",
      matchedEntryId: null,
      matchedLineId: null,
      matchedAt: null,
      matchedById: null,
    },
    include: movementInclude,
  })

  return mapMovement(updated)
}

export async function ignoreBankMovement(
  companyId: string,
  movementId: string,
): Promise<BankMovementView> {
  const updated = await prisma.bankMovement.update({
    where: { id: movementId, companyId },
    data: {
      status: "IGNORADO",
      matchedEntryId: null,
      matchedLineId: null,
      matchedAt: null,
      matchedById: null,
    },
    include: movementInclude,
  })

  return mapMovement(updated)
}

export async function reviewBankMovement(
  companyId: string,
  movementId: string,
  userId?: string,
): Promise<BankMovementView> {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId, status: "CONCILIADO" },
  })
  if (!movement) throw new Error("Solo se pueden revisar movimientos interpretados.")

  const updated = await prisma.bankMovement.update({
    where: { id: movementId },
    data: {
      status: "REVISADO",
      matchedById: userId ?? movement.matchedById,
    },
    include: movementInclude,
  })

  return mapMovement(updated)
}

export async function resetBankMovementToPending(
  companyId: string,
  movementId: string,
): Promise<BankMovementView> {
  const updated = await prisma.bankMovement.update({
    where: { id: movementId, companyId },
    data: {
      status: "PENDIENTE",
      matchedEntryId: null,
      matchedLineId: null,
      matchedAt: null,
      matchedById: null,
    },
    include: movementInclude,
  })

  return mapMovement(updated)
}

const AUTO_MATCH_MIN_SCORE = 85

async function tryAutoMatchMovement(
  companyId: string,
  movementId: string,
  userId?: string,
): Promise<boolean> {
  const candidates = await findReconciliationCandidates(companyId, movementId)
  const best = candidates[0]
  if (!best || best.score < AUTO_MATCH_MIN_SCORE) return false

  try {
    await matchBankMovement(companyId, movementId, best.entryLineId, userId)
    return true
  } catch {
    return false
  }
}

export async function analyzeBankMovement(
  companyId: string,
  movementId: string,
  userId?: string,
): Promise<{ matched: boolean; movement?: BankMovementView }> {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId, status: "PENDIENTE" },
  })
  if (!movement) throw new Error("Solo se pueden analizar movimientos pendientes.")

  const matched = await tryAutoMatchMovement(companyId, movementId, userId)
  if (!matched) return { matched: false }

  const updated = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId },
    include: movementInclude,
  })
  if (!updated) return { matched: true }

  return { matched: true, movement: mapMovement(updated) }
}

export async function deleteBankMovement(companyId: string, movementId: string): Promise<void> {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId },
  })
  if (!movement) throw new Error("Movimiento bancario no encontrado.")
  if (movement.status === "CONCILIADO" || movement.status === "REVISADO") {
    throw new Error("Desvincula el movimiento antes de eliminarlo.")
  }

  await prisma.bankMovement.delete({ where: { id: movementId } })
}

export async function autoReconcileBankMovements(
  companyId: string,
  userId?: string,
  movementId?: string,
): Promise<{ matched: number }> {
  if (movementId) {
    const matched = await tryAutoMatchMovement(companyId, movementId, userId)
    return { matched: matched ? 1 : 0 }
  }

  const pending = await prisma.bankMovement.findMany({
    where: { companyId, status: "PENDIENTE" },
    orderBy: { movementDate: "asc" },
    take: 300,
  })

  let matched = 0

  for (const movement of pending) {
    const didMatch = await tryAutoMatchMovement(companyId, movement.id, userId)
    if (didMatch) matched += 1
  }

  return { matched }
}
