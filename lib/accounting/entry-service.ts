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

  const entry = await prisma.accountingEntry.create({
    data: {
      companyId,
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
    await tx.entryLine.deleteMany({ where: { entryId } })
    return tx.accountingEntry.update({
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
  })

  return toEntryDetail(entry)
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
