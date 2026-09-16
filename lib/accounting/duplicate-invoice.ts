import { prisma } from "@/lib/db"
import { normalizeTaxId } from "@/lib/tax-id"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

export class DuplicateInvoiceError extends Error {
  readonly code = "DUPLICATE_INVOICE"
  readonly duplicate: DuplicateInvoiceMatch

  constructor(duplicate: DuplicateInvoiceMatch) {
    super(
      `Esta factura ya está contabilizada (asiento ${duplicate.refNumber}, nº ${duplicate.invoiceNumber}).`,
    )
    this.name = "DuplicateInvoiceError"
    this.duplicate = duplicate
  }
}

export interface DuplicateInvoiceMatch {
  entryId: string
  refNumber: number
  invoiceNumber: string
  fecha: string
}

export function normalizeInvoiceNumberKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s./-]+/g, "")
}

function commandCodeForDocumentType(documentType: "factura-recibida" | "factura-emitida") {
  return documentType === "factura-emitida" ? "17" : "34"
}

function parseStoredInvoice(json: string | null): Partial<InvoiceOcrResult> | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as Partial<InvoiceOcrResult>
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function matchesParty(params: {
  cif: string
  storedJson: string | null
  lineConcept?: string | null
}): boolean {
  const cif = normalizeTaxId(params.cif)
  if (!cif) return true

  const stored = parseStoredInvoice(params.storedJson)
  if (stored?.cif && normalizeTaxId(stored.cif) === cif) return true
  const storedNif = (stored as { nif?: string } | null)?.nif
  if (storedNif && normalizeTaxId(storedNif) === cif) return true
  if (params.lineConcept?.toUpperCase().includes(cif)) return true
  return false
}

export async function findDuplicateInvoiceEntry(params: {
  companyId: string
  documentType: "factura-recibida" | "factura-emitida"
  invoice: Pick<InvoiceOcrResult, "cif" | "numeroFactura" | "fechaFactura" | "total">
}): Promise<DuplicateInvoiceMatch | null> {
  const invoiceNumberKey = normalizeInvoiceNumberKey(params.invoice.numeroFactura)
  if (!invoiceNumberKey) return null

  const commandCode = commandCodeForDocumentType(params.documentType)
  const candidates = await prisma.accountingEntry.findMany({
    where: {
      companyId: params.companyId,
      commandCode,
      invoiceNumber: { not: null },
    },
    select: {
      id: true,
      refNumber: true,
      invoiceNumber: true,
      fecha: true,
      invoiceDataJson: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { concepto: true },
      },
    },
    take: 400,
    orderBy: { createdAt: "desc" },
  })

  const match = candidates.find((entry) => {
    if (normalizeInvoiceNumberKey(entry.invoiceNumber ?? "") !== invoiceNumberKey) return false
    return matchesParty({
      cif: params.invoice.cif,
      storedJson: entry.invoiceDataJson,
      lineConcept: entry.lines[0]?.concepto,
    })
  })

  if (!match) return null

  return {
    entryId: match.id,
    refNumber: match.refNumber,
    invoiceNumber: match.invoiceNumber ?? params.invoice.numeroFactura,
    fecha: match.fecha.toISOString().slice(0, 10),
  }
}
