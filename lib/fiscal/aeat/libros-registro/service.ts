import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { prisma } from "@/lib/db"
import { loadCompanyPurchaseContext } from "@/lib/accounting/company-purchase-context"
import { generateLibrosRegistroXlsx } from "@/lib/fiscal/aeat/libros-registro/generate-lsi-xlsx"
import { buildLibrosRegistroFilename } from "@/lib/fiscal/aeat/libros-registro/filename"
import {
  librosRegistroThroughQuarter,
  mapEntriesToLibrosRegistro,
} from "@/lib/fiscal/aeat/libros-registro/map-libros"
import type { LibrosRegistroEntityType } from "@/lib/fiscal/aeat/libros-registro/types"
import { getQuarterDateRange } from "@/lib/fiscal/panorama"
import { normalizeTaxId } from "@/lib/tax-id"

export async function buildLibrosRegistroExport(params: {
  companyId: string
  year: number
  quarter: number | "annual"
  companyName: string
  companyCif: string | null | undefined
}): Promise<{ buffer: Buffer; fileName: string; issuedCount: number; receivedCount: number }> {
  const throughQuarter = librosRegistroThroughQuarter(params.quarter)
  const start = new Date(`${params.year}-01-01T00:00:00.000Z`)
  const { end } = getQuarterDateRange(params.year, throughQuarter)

  const [entries, parties, purchaseContext] = await Promise.all([
    prisma.accountingEntry.findMany({
      where: {
        companyId: params.companyId,
        fecha: { gte: start, lte: end },
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ fecha: "asc" }, { refNumber: "asc" }],
    }),
    prisma.thirdParty.findMany({
      where: { companyId: params.companyId },
      select: { accountCode: true, cif: true, name: true },
    }),
    loadCompanyPurchaseContext(params.companyId),
  ])

  const entityType: LibrosRegistroEntityType =
    purchaseContext.entityType === "PERSONA_FISICA" ? "PERSONA_FISICA" : "PERSONA_JURIDICA"
  const includeIrpf = entityType === "PERSONA_FISICA"
  const nif = normalizeTaxId(params.companyCif ?? "").slice(0, 9)

  const books = mapEntriesToLibrosRegistro(
    entries.map((entry) => ({
      id: entry.id,
      fecha: entry.fecha.toISOString().slice(0, 10),
      issueDate: entry.issueDate?.toISOString().slice(0, 10) ?? null,
      operationDate: entry.operationDate?.toISOString().slice(0, 10) ?? null,
      invoiceNumber: entry.invoiceNumber,
      commandCode: entry.commandCode,
      invoiceDetails: parseInvoiceDetails(entry.invoiceDataJson),
      lines: entry.lines.map((line) => ({
        cuenta: line.cuenta,
        concepto: line.concepto,
        debe: decimalToNumber(line.debe),
        haber: decimalToNumber(line.haber),
      })),
    })),
    {
      year: params.year,
      throughQuarter,
      companyName: params.companyName,
      companyCif: nif,
      entityType,
      includeIrpf,
      activities: purchaseContext.activities,
      parties,
    },
  )

  const buffer = await generateLibrosRegistroXlsx({
    year: params.year,
    companyName: params.companyName,
    companyCif: nif || "SINNIF",
    books,
  })

  return {
    buffer,
    fileName: buildLibrosRegistroFilename({
      year: params.year,
      companyCif: nif,
      companyName: params.companyName,
      bookType: "T",
    }),
    issuedCount: books.issued.length,
    receivedCount: books.received.length,
  }
}
