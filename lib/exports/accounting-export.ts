import * as XLSX from "xlsx"
import { prisma } from "@/lib/db"
import {
  getAccountingFormatProfile,
  type AccountingSourceFormat,
} from "@/lib/imports/accounting-formats"

export interface ExportAccountingOptions {
  companyId: string
  sourceFormat: AccountingSourceFormat
  from?: string
  to?: string
}

function formatDateForExport(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatAmount(value: { toString(): string } | number): string {
  const num = typeof value === "number" ? value : Number.parseFloat(value.toString())
  return Number.isFinite(num) ? num.toFixed(2).replace(".", ",") : "0,00"
}

function escapeCsvCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildExportRow(
  sourceFormat: AccountingSourceFormat,
  data: {
    fecha: string
    asiento: string
    cuenta: string
    concepto: string
    debe: string
    haber: string
    documento: string
  },
): string[] {
  switch (sourceFormat) {
    case "a3":
      return [data.fecha, data.asiento, data.cuenta, data.concepto, data.debe, data.haber, data.documento]
    case "holded":
      return [data.fecha, data.cuenta, data.concepto, data.debe, data.haber, data.asiento]
    case "sage":
      return [data.fecha, data.asiento, data.cuenta, data.concepto, data.debe, data.haber, data.documento]
    default:
      return [data.fecha, data.cuenta, data.concepto, data.debe, data.haber]
  }
}

export async function exportAccountingEntries(options: ExportAccountingOptions) {
  const profile = getAccountingFormatProfile(options.sourceFormat)
  const where: { companyId: string; fecha?: { gte?: Date; lte?: Date } } = {
    companyId: options.companyId,
  }

  if (options.from || options.to) {
    where.fecha = {}
    if (options.from) where.fecha.gte = new Date(`${options.from}T00:00:00.000Z`)
    if (options.to) where.fecha.lte = new Date(`${options.to}T23:59:59.999Z`)
  }

  const entries = await prisma.accountingEntry.findMany({
    where,
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  })

  const rows: string[][] = [profile.exportHeaders]

  entries.forEach((entry, entryIndex) => {
    const fecha = formatDateForExport(entry.fecha)
    const asiento = entry.commandCode ?? String(entryIndex + 1)
    const documento = entry.commandCode ?? ""

    for (const line of entry.lines) {
      rows.push(
        buildExportRow(options.sourceFormat, {
          fecha,
          asiento,
          cuenta: line.cuenta,
          concepto: line.concepto,
          debe: formatAmount(line.debe),
          haber: formatAmount(line.haber),
          documento,
        }),
      )
    }
  })

  const csvBody = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell, profile.csvDelimiter)).join(profile.csvDelimiter))
    .join("\n")

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Diario")
  const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer

  const baseName = `export-${options.sourceFormat}-${new Date().toISOString().split("T")[0]}`

  return {
    rowsExported: Math.max(0, rows.length - 1),
    entriesExported: entries.length,
    csv: {
      content: `\uFEFF${csvBody}`,
      fileName: `${baseName}.csv`,
      mimeType: "text/csv;charset=utf-8",
    },
    xlsx: {
      buffer: xlsxBuffer,
      fileName: `${baseName}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  }
}
