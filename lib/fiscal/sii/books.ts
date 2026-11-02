import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import {
  isExpenseAccount,
  isIncomeAccount,
  isRepercutidoAccount,
  isSoportadoAccount,
  LIQUIDATION_COMMAND_CODES,
} from "@/lib/fiscal/aeat/libros-registro/codes"
import type { SiiBook, SiiInvoiceDraft, SiiInvoiceStatus, SiiVatDetail } from "@/lib/fiscal/sii/types"
import { normalizeTaxId } from "@/lib/tax-id"

export interface SiiSourceLine {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export interface SiiSourceEntry {
  id: string
  fecha: string
  issueDate?: string | null
  invoiceNumber?: string | null
  commandCode?: string | null
  invoiceDataJson?: string | null
  lines: SiiSourceLine[]
}

export interface SiiParty {
  accountCode: string
  cif: string | null
  name: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function aeatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return ""
  const [year, month, day] = iso.slice(0, 10).split("-")
  return `${day}-${month}-${year}`
}

function bookOf(entry: SiiSourceEntry): SiiBook | null {
  if (LIQUIDATION_COMMAND_CODES.has(entry.commandCode ?? "")) return null
  if (entry.commandCode === "17") return "EMITIDAS"
  if (entry.commandCode === "34") return "RECIBIDAS"

  const income = entry.lines
    .filter((line) => isIncomeAccount(line.cuenta))
    .reduce((sum, line) => sum + line.haber - line.debe, 0)
  const expense = entry.lines
    .filter((line) => isExpenseAccount(line.cuenta))
    .reduce((sum, line) => sum + line.debe - line.haber, 0)
  if (income <= 0 && expense <= 0 && !entry.invoiceNumber && !entry.invoiceDataJson) return null
  if (income > 0 && income >= expense) return "EMITIDAS"
  if (expense > 0) return "RECIBIDAS"
  return null
}

function partyOf(entry: SiiSourceEntry, parties: SiiParty[]): { nif: string; nombre: string } {
  const details = parseInvoiceDetails(entry.invoiceDataJson)
  const fromDetails = normalizeTaxId(details?.nif ?? "")
  if (fromDetails) {
    return { nif: fromDetails, nombre: details?.thirdPartyName?.trim() || "" }
  }
  for (const line of entry.lines) {
    const party = parties.find(
      (item) => item.accountCode && (line.cuenta === item.accountCode || line.cuenta.startsWith(item.accountCode)),
    )
    const nif = normalizeTaxId(party?.cif ?? "")
    if (nif) return { nif, nombre: party?.name?.trim() || details?.thirdPartyName?.trim() || "" }
  }
  return { nif: "", nombre: details?.thirdPartyName?.trim() || "" }
}

function detallesOf(entry: SiiSourceEntry, book: SiiBook): SiiVatDetail[] {
  const details = parseInvoiceDetails(entry.invoiceDataJson)
  const fromDetails = (details?.vatLines ?? [])
    .filter((line) => (line.base || 0) !== 0 || (line.quota || 0) !== 0)
    .map((line) => ({
      tipo: round2(line.vatPercent || 0),
      base: round2(line.base || 0),
      cuota: round2(line.quota || 0),
    }))
  if (fromDetails.length > 0) return mergeRates(fromDetails)

  const base = round2(
    entry.lines
      .filter((line) => (book === "EMITIDAS" ? isIncomeAccount(line.cuenta) : isExpenseAccount(line.cuenta)))
      .reduce((sum, line) => sum + (book === "EMITIDAS" ? line.haber - line.debe : line.debe - line.haber), 0),
  )
  const cuota = round2(
    entry.lines
      .filter((line) => (book === "EMITIDAS" ? isRepercutidoAccount(line.cuenta) : isSoportadoAccount(line.cuenta)))
      .reduce((sum, line) => sum + (book === "EMITIDAS" ? line.haber - line.debe : line.debe - line.haber), 0),
  )
  if (base === 0 && cuota === 0) return []
  const tipo = base !== 0 ? round2((cuota / base) * 100) : 0
  return [{ tipo, base, cuota }]
}

function mergeRates(lines: SiiVatDetail[]): SiiVatDetail[] {
  const byRate = new Map<number, SiiVatDetail>()
  for (const line of lines) {
    const current = byRate.get(line.tipo) ?? { tipo: line.tipo, base: 0, cuota: 0 }
    current.base = round2(current.base + line.base)
    current.cuota = round2(current.cuota + line.cuota)
    byRate.set(line.tipo, current)
  }
  return [...byRate.values()]
}

export function buildSiiInvoices(params: {
  entries: SiiSourceEntry[]
  parties: SiiParty[]
  year: number
  month: number
  cashBasisSubject: boolean
  previous?: Map<string, { status: string; csv: string | null; errorMessage: string | null }>
}): SiiInvoiceDraft[] {
  const periodo = String(params.month).padStart(2, "0")
  const invoices: SiiInvoiceDraft[] = []

  for (const entry of params.entries) {
    const book = bookOf(entry)
    if (!book) continue
    const details = parseInvoiceDetails(entry.invoiceDataJson)
    const iso = (book === "EMITIDAS" ? entry.issueDate || entry.fecha : entry.fecha).slice(0, 10)
    if (Number(iso.slice(0, 4)) !== params.year || Number(iso.slice(5, 7)) !== params.month) continue

    const numero = (details?.invoiceNumber || entry.invoiceNumber || "").trim()
    const party = partyOf(entry, params.parties)
    const fechaExpedicion = aeatDate((entry.issueDate || entry.fecha).slice(0, 10))
    const fechaRegistro = aeatDate(entry.fecha.slice(0, 10))
    const detalles = detallesOf(entry, book)
    const importeTotal = round2(detalles.reduce((sum, line) => sum + line.base + line.cuota, 0))
    const rectificativa = Boolean(details?.isRectificativa)
    const tipoFactura = rectificativa ? "R1" : party.nif ? "F1" : "F2"
    const invoiceKey = `${book}|${party.nif}|${numero}|${fechaExpedicion}`
    const previous = params.previous?.get(invoiceKey)

    let blockedReason: string | null = null
    if (!numero) blockedReason = "Falta el número de factura."
    else if (!fechaExpedicion) blockedReason = "Falta la fecha de expedición."
    else if (book === "RECIBIDAS" && !party.nif) blockedReason = "Falta el NIF del proveedor."
    else if (rectificativa) blockedReason = "La rectificativa se envía cuando consta la factura original."
    else if (detalles.length === 0) blockedReason = "Falta la base y la cuota de IVA."

    let status: SiiInvoiceStatus = blockedReason ? "INCOMPLETA" : "LISTA"
    if (previous?.status === "ACEPTADA") status = "ACEPTADA"
    else if (previous?.status === "RECHAZADA" && !blockedReason) status = "RECHAZADA"

    invoices.push({
      entryId: entry.id,
      book,
      ejercicio: params.year,
      periodo,
      numero,
      fechaExpedicion,
      fechaRegistro,
      nif: party.nif,
      nombre: party.nombre || "Sin nombre",
      tipoFactura,
      claveRegimen: params.cashBasisSubject ? "07" : "01",
      descripcion: (party.nombre || `Factura ${numero || "sin número"}`).slice(0, 500),
      importeTotal,
      detalles,
      invoiceKey,
      status,
      blockedReason: status === "ACEPTADA" ? null : blockedReason,
      csv: previous?.csv ?? null,
      errorMessage: status === "RECHAZADA" ? previous?.errorMessage ?? null : null,
    })
  }

  return invoices
}
