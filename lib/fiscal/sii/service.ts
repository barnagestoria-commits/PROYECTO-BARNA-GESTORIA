import { decimalToNumber } from "@/lib/prisma/decimal"
import { prisma } from "@/lib/db"
import { buildSiiInvoices, type SiiSourceEntry } from "@/lib/fiscal/sii/books"
import { parseSiiResponse, postSiiSoap } from "@/lib/fiscal/sii/submit"
import type { SiiBook, SiiInvoiceDraft } from "@/lib/fiscal/sii/types"
import { buildSiiSoap } from "@/lib/fiscal/sii/xml"
import { normalizeTaxId } from "@/lib/tax-id"

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  }
}

async function companyForSii(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, cif: true, siiMode: true, cashBasisSubject: true },
  })
  if (!company || company.siiMode === "NONE") return null
  return company
}

async function draftsForMonth(companyId: string, year: number, month: number): Promise<{
  companyName: string
  companyNif: string
  invoices: SiiInvoiceDraft[]
} | null> {
  const company = await companyForSii(companyId)
  if (!company) return null
  const { start, end } = monthBounds(year, month)
  const [entries, parties, previous] = await Promise.all([
    prisma.accountingEntry.findMany({
      where: {
        companyId,
        OR: [{ fecha: { gte: start, lte: end } }, { issueDate: { gte: start, lte: end } }],
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ fecha: "asc" }, { refNumber: "asc" }],
    }),
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, cif: true, name: true },
    }),
    prisma.siiInvoiceSubmission.findMany({
      where: { companyId, ejercicio: year, periodo: String(month).padStart(2, "0") },
    }),
  ])

  const source: SiiSourceEntry[] = entries.map((entry) => ({
    id: entry.id,
    fecha: entry.fecha.toISOString().slice(0, 10),
    issueDate: entry.issueDate?.toISOString().slice(0, 10) ?? null,
    invoiceNumber: entry.invoiceNumber,
    commandCode: entry.commandCode,
    invoiceDataJson: entry.invoiceDataJson,
    lines: entry.lines.map((line) => ({
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: decimalToNumber(line.debe),
      haber: decimalToNumber(line.haber),
    })),
  }))

  return {
    companyName: company.name,
    companyNif: normalizeTaxId(company.cif ?? ""),
    invoices: buildSiiInvoices({
      entries: source,
      parties,
      year,
      month,
      cashBasisSubject: company.cashBasisSubject,
      previous: new Map(
        previous.map((row) => [
          row.invoiceKey,
          { status: row.status, csv: row.csv, errorMessage: row.errorMessage },
        ]),
      ),
    }),
  }
}

export async function listSiiMonth(companyId: string, year: number, month: number) {
  return draftsForMonth(companyId, year, month)
}

export async function submitSiiMonth(params: {
  companyId: string
  year: number
  month: number
  book: SiiBook
  environment: "sandbox" | "production"
  pfx: Buffer
  passphrase: string
}): Promise<{ sent: number; accepted: number; rejected: number }> {
  const loaded = await draftsForMonth(params.companyId, params.year, params.month)
  if (!loaded) {
    throw new Error("Esta empresa no tiene el SII marcado en su ficha.")
  }
  if (!loaded.companyNif) {
    throw new Error("Falta el NIF de la empresa en la ficha.")
  }
  const pending = loaded.invoices.filter(
    (invoice) => invoice.book === params.book && (invoice.status === "LISTA" || invoice.status === "RECHAZADA"),
  )
  if (pending.length === 0) {
    throw new Error("No hay facturas listas para enviar en este libro.")
  }

  const xml = buildSiiSoap({
    book: params.book,
    titularNif: loaded.companyNif,
    titularNombre: loaded.companyName,
    invoices: pending,
  })
  let responseXml = ""
  try {
    responseXml = await postSiiSoap({
      book: params.book,
      environment: params.environment,
      xml,
      pfx: params.pfx,
      passphrase: params.passphrase,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido conectar con el SII."
    throw new Error(
      message.includes("certificate") || message.includes("mac verify") || message.includes("PKCS12")
        ? "El certificado o la contraseña no han sido aceptados."
        : "No se ha podido conectar con el servicio SII de Hacienda.",
    )
  }

  const parsed = parseSiiResponse(responseXml)
  if (parsed.fault) {
    throw new Error(parsed.fault)
  }
  if (parsed.lines.length === 0) {
    throw new Error(
      parsed.envelopeStatus
        ? `Hacienda ha respondido ${parsed.envelopeStatus} sin detalle de facturas.`
        : "Hacienda no ha devuelto el resultado de las facturas.",
    )
  }

  let accepted = 0
  let rejected = 0
  for (const invoice of pending) {
    const line =
      parsed.lines.find((item) => item.numero === invoice.numero && item.fecha === invoice.fechaExpedicion) ??
      parsed.lines.find((item) => item.numero === invoice.numero)
    const status = line?.status ?? "RECHAZADA"
    if (status === "ACEPTADA") accepted += 1
    else rejected += 1
    await prisma.siiInvoiceSubmission.upsert({
      where: { companyId_invoiceKey: { companyId: params.companyId, invoiceKey: invoice.invoiceKey } },
      create: {
        companyId: params.companyId,
        book: invoice.book,
        ejercicio: invoice.ejercicio,
        periodo: invoice.periodo,
        invoiceKey: invoice.invoiceKey,
        status,
        csv: line?.csv ?? null,
        errorCode: line?.errorCode ?? null,
        errorMessage: line?.errorMessage ?? null,
      },
      update: {
        status,
        csv: line?.csv ?? null,
        errorCode: line?.errorCode ?? null,
        errorMessage: line?.errorMessage ?? null,
        sentAt: new Date(),
      },
    })
  }

  return { sent: pending.length, accepted, rejected }
}
