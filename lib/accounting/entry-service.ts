import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { ACCOUNTING_COMMANDS, calculateTotals } from "@/lib/accounting/command-templates"
import {
  buildEntryDetail,
  normalizeEntryLines,
  parseEntryDate,
  serializeInvoiceDetails,
  type AccountingEntryDetail,
  type SaveAccountingEntryInput,
} from "@/lib/accounting/entry-payload"
import { getNextEntryRefNumber } from "@/lib/accounting/entry-ref-service"
import {
  saveAccountAnalyticTemplate,
} from "@/lib/accounting/analytic-accounting-service"
import { isAnalyticAccount } from "@/lib/accounting/analytic-accounting-types"
import { createDefaultInvoiceDetails } from "@/lib/types/invoice-entry-details"

const COMMAND_CODES = new Set(Object.keys(ACCOUNTING_COMMANDS))

function mapEntryLines(
  lines: Array<{
    id: string
    sortOrder: number
    cuenta: string
    concepto: string
    debe: Prisma.Decimal
    haber: Prisma.Decimal
  }>,
) {
  return lines
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => ({
      id: line.id,
      sortOrder: line.sortOrder,
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: decimalToNumber(line.debe),
      haber: decimalToNumber(line.haber),
    }))
}

function toEntryDetail(entry: {
  id: string
  companyId: string
  refNumber: number
  fecha: Date
  issueDate: Date | null
  operationDate: Date | null
  invoiceNumber: string | null
  invoiceDataJson: string | null
  commandCode: string | null
  createdAt: Date
  lines: Array<{
    id: string
    sortOrder: number
    cuenta: string
    concepto: string
    debe: Prisma.Decimal
    haber: Prisma.Decimal
  }>
}): AccountingEntryDetail {
  const lines = mapEntryLines(entry.lines)
  const totals = calculateTotals(lines.map((line) => ({ ...line, id: line.id })))

  return buildEntryDetail({
    ...entry,
    lines,
    totals,
  })
}

function resolveInvoiceFields(input: SaveAccountingEntryInput, fecha: Date) {
  const invoiceDetails = input.invoiceDetails ?? null
  const issueDate = parseEntryDate(input.issueDate ?? invoiceDetails?.issueDate) ?? fecha
  const operationDate =
    parseEntryDate(input.operationDate ?? invoiceDetails?.operationDate) ?? issueDate

  return {
    issueDate,
    operationDate,
    invoiceNumber: input.invoiceNumber ?? invoiceDetails?.invoiceNumber ?? null,
    invoiceDataJson: serializeInvoiceDetails(
      invoiceDetails
        ? {
            ...invoiceDetails,
            issueDate: issueDate.toISOString().split("T")[0],
            operationDate: operationDate.toISOString().split("T")[0],
          }
        : null,
    ),
  }
}

export async function getAccountingEntryById(
  companyId: string,
  entryId: string,
): Promise<AccountingEntryDetail | null> {
  const entry = await prisma.accountingEntry.findFirst({
    where: { id: entryId, companyId },
    include: { lines: true },
  })

  if (!entry) return null
  return toEntryDetail(entry)
}

export async function createAccountingEntry(
  companyId: string,
  createdById: string,
  input: SaveAccountingEntryInput,
): Promise<AccountingEntryDetail> {
  const fecha = parseEntryDate(input.fecha)
  if (!fecha) throw new Error("Fecha de asiento no válida.")

  const commandCode =
    input.commandCode && COMMAND_CODES.has(input.commandCode) ? input.commandCode : null

  const normalized = normalizeEntryLines(input.lines)
  if ("error" in normalized) throw new Error(normalized.error)

  const totals = calculateTotals(
    normalized.lines.map((line, index) => ({ ...line, id: `temp-${index}` })),
  )
  if (!totals.isBalanced) {
    throw new Error(
      `El asiento está descuadrado (diferencia ${Math.abs(totals.difference).toFixed(2)} €).`,
    )
  }

  const invoiceFields = resolveInvoiceFields(input, fecha)

  const entry = await prisma.$transaction(async (tx) => {
    const refNumber = await getNextEntryRefNumber(companyId, tx)

    const created = await tx.accountingEntry.create({
      data: {
        companyId,
        refNumber,
        fecha,
        issueDate: invoiceFields.issueDate,
        operationDate: invoiceFields.operationDate,
        invoiceNumber: invoiceFields.invoiceNumber,
        invoiceDataJson: invoiceFields.invoiceDataJson,
        commandCode,
        createdById,
        lines: {
          create: normalized.lines.map((line, index) => ({
            sortOrder: index,
            cuenta: line.cuenta,
            concepto: line.concepto,
            debe: line.debe,
            haber: line.haber,
          })),
        },
      },
      include: { lines: true },
    })

    for (let index = 0; index < created.lines.length; index++) {
      const line = created.lines[index]
      const source = normalized.lines[index]
      const distributions = source.analyticDistributions ?? []
      if (distributions.length > 0) {
        await tx.entryLineAnalyticDistribution.createMany({
          data: distributions.map((item) => ({
            entryLineId: line.id,
            costCenterId: item.costCenterId,
            percentage: item.percentage,
            amount: item.amount,
          })),
        })
      }
    }

    return created
  })

  for (let index = 0; index < entry.lines.length; index++) {
    const line = entry.lines[index]
    const source = normalized.lines[index]
    const distributions = source.analyticDistributions ?? []
    if (distributions.length > 0 && isAnalyticAccount(line.cuenta)) {
      await saveAccountAnalyticTemplate(companyId, line.cuenta, distributions)
    }
  }

  return toEntryDetail(entry)
}

export async function updateAccountingEntry(
  companyId: string,
  entryId: string,
  input: SaveAccountingEntryInput,
): Promise<AccountingEntryDetail> {
  const existing = await prisma.accountingEntry.findFirst({
    where: { id: entryId, companyId },
    select: { id: true },
  })
  if (!existing) throw new Error("Asiento no encontrado.")

  const fecha = parseEntryDate(input.fecha)
  if (!fecha) throw new Error("Fecha de asiento no válida.")

  const commandCode =
    input.commandCode && COMMAND_CODES.has(input.commandCode) ? input.commandCode : null

  const normalized = normalizeEntryLines(input.lines)
  if ("error" in normalized) throw new Error(normalized.error)

  const totals = calculateTotals(
    normalized.lines.map((line, index) => ({ ...line, id: `temp-${index}` })),
  )
  if (!totals.isBalanced) {
    throw new Error(
      `El asiento está descuadrado (diferencia ${Math.abs(totals.difference).toFixed(2)} €).`,
    )
  }

  const invoiceFields = resolveInvoiceFields(input, fecha)

  const entry = await prisma.$transaction(async (tx) => {
    const existingLines = await tx.entryLine.findMany({
      where: { entryId },
      select: { id: true },
    })
    if (existingLines.length > 0) {
      await tx.entryLineAnalyticDistribution.deleteMany({
        where: { entryLineId: { in: existingLines.map((line) => line.id) } },
      })
    }

    await tx.entryLine.deleteMany({ where: { entryId } })

    const updated = await tx.accountingEntry.update({
      where: { id: entryId },
      data: {
        fecha,
        issueDate: invoiceFields.issueDate,
        operationDate: invoiceFields.operationDate,
        invoiceNumber: invoiceFields.invoiceNumber,
        invoiceDataJson: invoiceFields.invoiceDataJson,
        commandCode,
        lines: {
          create: normalized.lines.map((line, index) => ({
            sortOrder: index,
            cuenta: line.cuenta,
            concepto: line.concepto,
            debe: line.debe,
            haber: line.haber,
          })),
        },
      },
      include: { lines: true },
    })

    for (let index = 0; index < updated.lines.length; index++) {
      const line = updated.lines[index]
      const source = normalized.lines[index]
      const distributions = source.analyticDistributions ?? []
      if (distributions.length > 0) {
        await tx.entryLineAnalyticDistribution.createMany({
          data: distributions.map((item) => ({
            entryLineId: line.id,
            costCenterId: item.costCenterId,
            percentage: item.percentage,
            amount: item.amount,
          })),
        })
      }
    }

    return updated
  })

  for (let index = 0; index < entry.lines.length; index++) {
    const line = entry.lines[index]
    const source = normalized.lines[index]
    const distributions = source.analyticDistributions ?? []
    if (distributions.length > 0 && isAnalyticAccount(line.cuenta)) {
      await saveAccountAnalyticTemplate(companyId, line.cuenta, distributions)
    }
  }

  return toEntryDetail(entry)
}

export async function deleteAccountingEntry(companyId: string, entryId: string): Promise<void> {
  const existing = await prisma.accountingEntry.findFirst({
    where: { id: entryId, companyId },
    select: { id: true },
  })

  if (!existing) {
    throw new Error("Asiento no encontrado.")
  }

  await prisma.accountingEntry.delete({
    where: { id: entryId },
  })
}

export interface CompanyAccountingVolume {
  entryCount: number
  lineCount: number
  importCount: number
  matchedBankMovementCount: number
}

export type AccountingEntryPurgeMode = "all" | "quarter" | "ref"

export interface AccountingEntryPurgeFilter {
  mode: AccountingEntryPurgeMode
  year?: number
  quarter?: 1 | 2 | 3 | 4
  refNumbers?: number[]
  refFrom?: number
  refTo?: number
}

const QUARTER_DATE_RANGES: Record<1 | 2 | 3 | 4, [string, string]> = {
  1: ["01-01", "03-31"],
  2: ["04-01", "06-30"],
  3: ["07-01", "09-30"],
  4: ["10-01", "12-31"],
}

function quarterDateBounds(year: number, quarter: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const [startDay, endDay] = QUARTER_DATE_RANGES[quarter]
  return {
    start: new Date(`${year}-${startDay}T00:00:00.000Z`),
    end: new Date(`${year}-${endDay}T23:59:59.999Z`),
  }
}

function buildAccountingEntryPurgeWhere(
  companyId: string,
  filter: AccountingEntryPurgeFilter,
): Prisma.AccountingEntryWhereInput {
  if (filter.mode === "all") {
    return { companyId }
  }

  if (filter.mode === "quarter") {
    if (!filter.year || !filter.quarter) {
      throw new Error("Indica el ejercicio y el trimestre.")
    }
    const { start, end } = quarterDateBounds(filter.year, filter.quarter)
    return { companyId, fecha: { gte: start, lte: end } }
  }

  const refConditions: Prisma.AccountingEntryWhereInput[] = []
  if (filter.refNumbers?.length) {
    refConditions.push({ refNumber: { in: filter.refNumbers } })
  }
  if (filter.refFrom != null && filter.refTo != null) {
    refConditions.push({ refNumber: { gte: filter.refFrom, lte: filter.refTo } })
  }

  if (refConditions.length === 0) {
    throw new Error("Indica al menos un número de asiento o un rango.")
  }

  return {
    companyId,
    OR: refConditions,
  }
}

export function parseRefNumberInput(input: string): Pick<
  AccountingEntryPurgeFilter,
  "refNumbers" | "refFrom" | "refTo"
> | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (rangeMatch) {
    const from = Number.parseInt(rangeMatch[1], 10)
    const to = Number.parseInt(rangeMatch[2], 10)
    if (Number.isNaN(from) || Number.isNaN(to) || from <= 0 || to <= 0) return null
    return from <= to ? { refFrom: from, refTo: to } : { refFrom: to, refTo: from }
  }

  if (trimmed.includes(",")) {
    const refNumbers = trimmed
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => !Number.isNaN(value) && value > 0)
    return refNumbers.length > 0 ? { refNumbers } : null
  }

  const single = Number.parseInt(trimmed, 10)
  return !Number.isNaN(single) && single > 0 ? { refNumbers: [single] } : null
}

export function parseAccountingEntryPurgeFilter(input: {
  mode?: string
  year?: string | number
  quarter?: string | number
  refs?: string
  refNumbers?: string
}): AccountingEntryPurgeFilter {
  const mode = input.mode === "quarter" || input.mode === "ref" ? input.mode : "all"

  if (mode === "all") {
    return { mode: "all" }
  }

  if (mode === "quarter") {
    const year = Number.parseInt(String(input.year ?? ""), 10)
    const quarter = Number.parseInt(String(input.quarter ?? ""), 10)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error("Ejercicio no válido.")
    }
    if (![1, 2, 3, 4].includes(quarter)) {
      throw new Error("Trimestre no válido.")
    }
    return { mode: "quarter", year, quarter: quarter as 1 | 2 | 3 | 4 }
  }

  const parsedRefs = parseRefNumberInput(String(input.refs ?? input.refNumbers ?? ""))
  if (!parsedRefs) {
    throw new Error("Indica un asiento, varios separados por coma o un rango (p. ej. 100-200).")
  }

  return { mode: "ref", ...parsedRefs }
}

export async function getCompanyAccountingVolume(
  companyId: string,
  filter: AccountingEntryPurgeFilter = { mode: "all" },
): Promise<CompanyAccountingVolume> {
  const where = buildAccountingEntryPurgeWhere(companyId, filter)

  const [entryCount, lineCount, importCount, matchedBankMovementCount] = await Promise.all([
    prisma.accountingEntry.count({ where }),
    prisma.entryLine.count({ where: { entry: where } }),
    filter.mode === "all"
      ? prisma.accountingDataImport.count({ where: { companyId } })
      : Promise.resolve(0),
    prisma.bankMovement.count({
      where: {
        companyId,
        matchedEntryId: { not: null },
        matchedEntry: where,
      },
    }),
  ])

  return { entryCount, lineCount, importCount, matchedBankMovementCount }
}

export interface DeleteAccountingEntriesResult {
  entriesDeleted: number
  importsDeleted: number
  bankMovementsReset: number
}

/**
 * Borra asientos según el filtro indicado.
 * Las líneas se eliminan en cascada; las conciliaciones afectadas vuelven a pendiente.
 * Solo el borrado total elimina también el historial de importaciones.
 */
export async function deleteAccountingEntries(
  companyId: string,
  filter: AccountingEntryPurgeFilter = { mode: "all" },
): Promise<DeleteAccountingEntriesResult> {
  if (filter.mode === "all") {
    return deleteAllAccountingEntries(companyId)
  }

  const where = buildAccountingEntryPurgeWhere(companyId, filter)
  const entriesToDelete = await prisma.accountingEntry.findMany({
    where,
    select: { id: true },
  })
  const entryIds = entriesToDelete.map((entry) => entry.id)

  if (entryIds.length === 0) {
    return { entriesDeleted: 0, importsDeleted: 0, bankMovementsReset: 0 }
  }

  const [bankMovements, entries] = await prisma.$transaction([
    prisma.bankMovement.updateMany({
      where: { companyId, matchedEntryId: { in: entryIds } },
      data: {
        status: "PENDIENTE",
        matchedEntryId: null,
        matchedLineId: null,
        matchedAt: null,
        matchedById: null,
      },
    }),
    prisma.accountingEntry.deleteMany({ where: { id: { in: entryIds } } }),
  ])

  return {
    entriesDeleted: entries.count,
    importsDeleted: 0,
    bankMovementsReset: bankMovements.count,
  }
}

/**
 * Vacía la contabilidad de una empresa para poder reimportarla desde cero.
 * Las líneas se borran en cascada; las conciliaciones bancarias vuelven a pendiente
 * para que no queden apuntando a asientos inexistentes.
 */
export async function deleteAllAccountingEntries(
  companyId: string,
): Promise<DeleteAccountingEntriesResult> {
  const [bankMovements, imports, entries] = await prisma.$transaction([
    prisma.bankMovement.updateMany({
      where: { companyId, matchedEntryId: { not: null } },
      data: {
        status: "PENDIENTE",
        matchedEntryId: null,
        matchedLineId: null,
        matchedAt: null,
        matchedById: null,
      },
    }),
    prisma.accountingDataImport.deleteMany({ where: { companyId } }),
    prisma.accountingEntry.deleteMany({ where: { companyId } }),
  ])

  return {
    entriesDeleted: entries.count,
    importsDeleted: imports.count,
    bankMovementsReset: bankMovements.count,
  }
}

export function hasInvoiceData(entry: AccountingEntryDetail): boolean {
  return Boolean(
    entry.invoiceDetails ||
      entry.invoiceNumber ||
      entry.commandCode === "17" ||
      entry.commandCode === "34",
  )
}

export function getEditableInvoiceDetails(entry: AccountingEntryDetail) {
  if (entry.invoiceDetails) {
    return {
      ...entry.invoiceDetails,
      issueDate: entry.issueDate ?? entry.invoiceDetails.issueDate,
      operationDate: entry.operationDate ?? entry.invoiceDetails.operationDate,
      invoiceNumber: entry.invoiceNumber ?? entry.invoiceDetails.invoiceNumber,
    }
  }

  if (hasInvoiceData(entry)) {
    const base = createDefaultInvoiceDetails(entry.fecha)
    return {
      ...base,
      issueDate: entry.issueDate ?? entry.fecha,
      operationDate: entry.operationDate ?? entry.fecha,
      invoiceNumber: entry.invoiceNumber ?? "",
    }
  }

  return null
}
