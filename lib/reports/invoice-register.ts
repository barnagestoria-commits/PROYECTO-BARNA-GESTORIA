import ExcelJS from "exceljs"
import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import { loadCompanyPurchaseContext } from "@/lib/accounting/company-purchase-context"
import { mapEntriesToLibrosRegistro } from "@/lib/fiscal/aeat/libros-registro/map-libros"
import type { IssuedLibrosRow, ReceivedLibrosRow } from "@/lib/fiscal/aeat/libros-registro/types"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/prisma/decimal"
import { normalizeTaxId } from "@/lib/tax-id"

export type InvoiceRegisterBook = "emitidas" | "recibidas" | "ambas"

export interface InvoiceRegisterQuery {
  from: string
  to: string
  book: InvoiceRegisterBook
  withTotal: boolean
  splitRectificativas: boolean
  splitOperation: boolean
}

export interface InvoiceRegisterRow {
  book: "emitidas" | "recibidas"
  isoDate: string
  date: string
  number: string
  party: string
  nif: string
  base: number
  vatRate: number
  vatQuota: number
  total: number
  operation: string
  invoiceType: string
  rectificativa: boolean
}

export interface InvoiceRegisterSection {
  book: "emitidas" | "recibidas"
  title: string
  rows: InvoiceRegisterRow[]
  base: number
  vatQuota: number
  total: number
}

export interface InvoiceRegisterListing {
  from: string
  to: string
  companyName: string
  sections: InvoiceRegisterSection[]
  issuedCount: number
  receivedCount: number
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF145A32" },
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function parseInvoiceRegisterQuery(url: URL): InvoiceRegisterQuery | { error: string } {
  const from = url.searchParams.get("from")?.trim() ?? ""
  const to = url.searchParams.get("to")?.trim() ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: "Indica un rango de fechas válido." }
  }
  if (from > to) return { error: "La fecha desde no puede ser posterior a la fecha hasta." }
  const bookParam = url.searchParams.get("book") ?? "ambas"
  const book: InvoiceRegisterBook =
    bookParam === "emitidas" || bookParam === "recibidas" ? bookParam : "ambas"
  return {
    from,
    to,
    book,
    withTotal: url.searchParams.get("totals") !== "0",
    splitRectificativas: url.searchParams.get("splitRect") !== "0",
    splitOperation: url.searchParams.get("splitOp") !== "0",
  }
}

function spanishDateToIso(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ""
  return `${match[3]}-${match[2]}-${match[1]}`
}

function operationTitle(row: {
  rectificativa: boolean
  exenta: boolean
  calificacion: string
  clave: string
}): string {
  if (row.rectificativa) return "Facturas rectificativas"
  if (row.exenta) return "Operaciones exentas"
  if (row.calificacion === "S2") return "Inversión del sujeto pasivo"
  if (row.clave && row.clave !== "01") return `Clave de operación ${row.clave}`
  return "Operaciones interiores"
}

function rowFromIssued(row: IssuedLibrosRow): InvoiceRegisterRow {
  const isoDate = spanishDateToIso(row.fechaOperacion || row.fechaExpedicion)
  const rectificativa = row.tipoFactura.startsWith("R")
  return {
    book: "emitidas",
    isoDate,
    date: row.fechaExpedicion || row.fechaOperacion,
    number: [row.serie, row.numero].filter(Boolean).join("-"),
    party: row.nombreDestinatario,
    nif: row.nifIdentificacion,
    base: Number(row.baseImponible) || 0,
    vatRate: Number(row.tipoIva) || 0,
    vatQuota: Number(row.cuotaIva) || 0,
    total: Number(row.totalFactura) || 0,
    operation: operationTitle({
      rectificativa,
      exenta: Boolean(row.operacionExenta),
      calificacion: row.calificacion,
      clave: row.claveOperacion,
    }),
    invoiceType: row.tipoFactura,
    rectificativa,
  }
}

function rowFromReceived(row: ReceivedLibrosRow): InvoiceRegisterRow {
  const isoDate = spanishDateToIso(row.fechaOperacion || row.fechaExpedicion || row.fechaRecepcion)
  const rectificativa = row.tipoFactura.startsWith("R")
  return {
    book: "recibidas",
    isoDate,
    date: row.fechaExpedicion || row.fechaRecepcion,
    number: row.serieNumero,
    party: row.nombreExpedidor,
    nif: row.nifIdentificacion,
    base: Number(row.baseImponible) || 0,
    vatRate: Number(row.tipoIva) || 0,
    vatQuota: Number(row.cuotaIva) || 0,
    total: Number(row.totalFactura) || 0,
    operation: operationTitle({
      rectificativa,
      exenta: Boolean(row.inversionSujetoPasivo === "S" ? false : row.claveOperacion === "09"),
      calificacion: row.inversionSujetoPasivo === "S" ? "S2" : "",
      clave: row.claveOperacion,
    }),
    invoiceType: row.tipoFactura,
    rectificativa,
  }
}

function inRange(isoDate: string, from: string, to: string): boolean {
  if (!isoDate) return true
  return isoDate >= from && isoDate <= to
}

function sectionOf(book: "emitidas" | "recibidas", title: string, rows: InvoiceRegisterRow[]): InvoiceRegisterSection {
  return {
    book,
    title,
    rows,
    base: round2(rows.reduce((sum, row) => sum + row.base, 0)),
    vatQuota: round2(rows.reduce((sum, row) => sum + row.vatQuota, 0)),
    total: round2(rows.reduce((sum, row) => sum + row.total, 0)),
  }
}

export function groupInvoiceRegister(
  rows: InvoiceRegisterRow[],
  query: InvoiceRegisterQuery,
): InvoiceRegisterSection[] {
  const books: Array<"emitidas" | "recibidas"> =
    query.book === "ambas" ? ["emitidas", "recibidas"] : [query.book]
  const sections: InvoiceRegisterSection[] = []

  for (const book of books) {
    const bookRows = rows.filter((row) => row.book === book)
    const bookLabel = book === "emitidas" ? "Facturas emitidas" : "Facturas recibidas"
    const rectificativas = bookRows.filter((row) => row.rectificativa)
    const ordinarias = query.splitRectificativas ? bookRows.filter((row) => !row.rectificativa) : bookRows

    if (query.splitOperation) {
      const groups = new Map<string, InvoiceRegisterRow[]>()
      for (const row of ordinarias) {
        const title = row.rectificativa ? "Facturas rectificativas" : row.operation
        const current = groups.get(title) ?? []
        current.push(row)
        groups.set(title, current)
      }
      for (const [title, groupRows] of groups) {
        sections.push(sectionOf(book, `${bookLabel} — ${title}`, groupRows))
      }
    } else if (ordinarias.length > 0) {
      sections.push(sectionOf(book, bookLabel, ordinarias))
    }

    if (query.splitRectificativas && rectificativas.length > 0) {
      sections.push(sectionOf(book, `${bookLabel} — Facturas rectificativas`, rectificativas))
    }
  }

  return sections
}

export async function buildInvoiceRegisterListing(
  companyId: string,
  query: InvoiceRegisterQuery,
): Promise<InvoiceRegisterListing> {
  const startYear = Number(query.from.slice(0, 4))
  const endYear = Number(query.to.slice(0, 4))
  const rangeStart = new Date(`${query.from}T00:00:00.000Z`)
  const rangeEnd = new Date(`${query.to}T23:59:59.999Z`)

  const [company, entries, parties, purchaseContext] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, cif: true },
    }),
    prisma.accountingEntry.findMany({
      where: { companyId, fecha: { gte: rangeStart, lte: rangeEnd } },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ fecha: "asc" }, { refNumber: "asc" }],
    }),
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, cif: true, name: true },
    }),
    loadCompanyPurchaseContext(companyId),
  ])

  const mappedEntries = entries.map((entry) => ({
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
  }))

  const rows: InvoiceRegisterRow[] = []
  for (let year = startYear; year <= endYear; year += 1) {
    const books = mapEntriesToLibrosRegistro(mappedEntries, {
      year,
      throughQuarter: 4,
      companyName: company?.name ?? "",
      companyCif: normalizeTaxId(company?.cif ?? "").slice(0, 9),
      entityType: purchaseContext.entityType === "PERSONA_FISICA" ? "PERSONA_FISICA" : "PERSONA_JURIDICA",
      includeIrpf: purchaseContext.entityType === "PERSONA_FISICA",
      activities: purchaseContext.activities,
      parties,
    })
    rows.push(
      ...books.issued.map(rowFromIssued),
      ...books.received.map(rowFromReceived),
    )
  }

  const filtered = rows.filter((row) => inRange(row.isoDate, query.from, query.to))
  const visible =
    query.book === "ambas" ? filtered : filtered.filter((row) => row.book === query.book)

  return {
    from: query.from,
    to: query.to,
    companyName: company?.name ?? "",
    sections: groupInvoiceRegister(visible, query),
    issuedCount: visible.filter((row) => row.book === "emitidas").length,
    receivedCount: visible.filter((row) => row.book === "recibidas").length,
  }
}

function money(value: number): number {
  return round2(value)
}

export async function buildInvoiceRegisterXlsx(listing: InvoiceRegisterListing, withTotal: boolean): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Barna Gestoría"
  const sheet = workbook.addWorksheet("Libro de facturas")
  const headers = [
    "Libro",
    "Fecha",
    "Número",
    "Tercero",
    "NIF",
    "Base imponible",
    "% IVA",
    "Cuota IVA",
    ...(withTotal ? ["Total factura"] : []),
    "Tipo",
    "Operación",
  ]
  sheet.addRow([listing.companyName, `Del ${listing.from} al ${listing.to}`])
  sheet.addRow([])
  const header = sheet.addRow(headers)
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
  header.fill = HEADER_FILL

  for (const section of listing.sections) {
    const title = sheet.addRow([section.title])
    title.font = { bold: true, color: { argb: "FF0F3D2E" } }
    for (const row of section.rows) {
      sheet.addRow([
        row.book === "emitidas" ? "Emitida" : "Recibida",
        row.date,
        row.number,
        row.party,
        row.nif,
        money(row.base),
        row.vatRate,
        money(row.vatQuota),
        ...(withTotal ? [money(row.total)] : []),
        row.invoiceType,
        row.operation,
      ])
    }
    const totalRow = sheet.addRow([
      "",
      "",
      "",
      "",
      "Total",
      money(section.base),
      "",
      money(section.vatQuota),
      ...(withTotal ? [money(section.total)] : []),
    ])
    totalRow.font = { bold: true }
    sheet.addRow([])
  }

  sheet.columns.forEach((column) => {
    column.width = 18
  })
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
