import { prisma } from "@/lib/db"
import { canonicalAccountDigits } from "@/lib/accounting/canonical-account-code"
import {
  isDuplicateInvoiceSignal,
  normalizeInvoiceNumberKey,
  type DuplicateInvoiceMatch,
  type DuplicateInvoiceProbe,
} from "@/lib/accounting/duplicate-invoice"
import { isThirdPartyAccountPrefix } from "@/lib/accounting/new-account-prefix"
import { extractSpanishTaxId } from "@/lib/fiscal/party-identification"
import { normalizeTaxId } from "@/lib/tax-id"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

function cifFromStoredJson(json: Record<string, unknown> | null): string {
  if (!json) return ""
  const cif = typeof json.cif === "string" ? json.cif : ""
  const nif = typeof json.nif === "string" ? json.nif : ""
  return normalizeTaxId(cif || nif)
}

function invoiceNumberFromStoredJson(json: Record<string, unknown> | null): string {
  if (!json) return ""
  const invoiceNumber = typeof json.invoiceNumber === "string" ? json.invoiceNumber : ""
  const numeroFactura = typeof json.numeroFactura === "string" ? json.numeroFactura : ""
  return invoiceNumber || numeroFactura
}

function invoiceNumberFromConcept(concepto: string): string {
  const match = concepto.match(/factura n\.?\s*(.+)$/i)
  return match?.[1]?.trim() ?? ""
}

function parseStoredJson(json: string | null): Record<string, unknown> | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function thirdPartyLine(
  lines: Array<{ cuenta: string; debe: unknown; haber: unknown; concepto: string }>,
) {
  return lines.find((line) => isThirdPartyAccountPrefix(line.cuenta)) ?? lines[0] ?? null
}

function probeFromStoredEntry(entry: {
  invoiceNumber: string | null
  fecha: Date
  invoiceDataJson: string | null
  lines: Array<{ cuenta: string; debe: unknown; haber: unknown; concepto: string }>
}): DuplicateInvoiceProbe {
  const json = parseStoredJson(entry.invoiceDataJson)
  const partyLine = thirdPartyLine(entry.lines)
  const debe = partyLine ? Number(partyLine.debe) : 0
  const haber = partyLine ? Number(partyLine.haber) : 0
  const jsonTotal = typeof json?.total === "number" ? json.total : 0

  return {
    cif: cifFromStoredJson(json) || extractSpanishTaxId(partyLine?.concepto ?? "") || undefined,
    numeroFactura:
      entry.invoiceNumber ||
      invoiceNumberFromStoredJson(json) ||
      invoiceNumberFromConcept(partyLine?.concepto ?? "") ||
      undefined,
    fechaFactura: entry.fecha.toISOString().slice(0, 10),
    total: Math.max(debe, haber, jsonTotal) || undefined,
    accountCode: partyLine?.cuenta,
  }
}

function commandCodeForDocumentType(documentType: "factura-recibida" | "factura-emitida") {
  return documentType === "factura-emitida" ? "17" : "34"
}

function commandTypeFromCode(
  commandCode: string | null,
): "factura-recibida" | "factura-emitida" | null {
  if (commandCode === "17") return "factura-emitida"
  if (commandCode === "34") return "factura-recibida"
  return null
}

function thirdPartyFamily(
  accountCode: string,
  documentType?: "factura-recibida" | "factura-emitida" | null,
): "emitida" | "recibida" | null {
  const digits = canonicalAccountDigits(accountCode)
  if (digits.startsWith("430")) return "emitida"
  if (digits.startsWith("400") || digits.startsWith("410")) return "recibida"
  if (documentType === "factura-emitida") return "emitida"
  if (documentType === "factura-recibida") return "recibida"
  return null
}

function parseEntryDate(value?: string): Date | undefined {
  const trimmed = value?.trim().slice(0, 10) ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function findDuplicateInvoiceEntry(params: {
  companyId: string
  documentType: "factura-recibida" | "factura-emitida"
  invoice: Pick<InvoiceOcrResult, "cif" | "numeroFactura" | "fechaFactura" | "total"> & {
    accountCode?: string
  }
  excludeEntryId?: string
}): Promise<DuplicateInvoiceMatch | null> {
  const incoming: DuplicateInvoiceProbe = {
    cif: params.invoice.cif,
    numeroFactura: params.invoice.numeroFactura,
    fechaFactura: params.invoice.fechaFactura,
    total: params.invoice.total,
    accountCode: params.invoice.accountCode,
  }

  const hasNumber = Boolean(normalizeInvoiceNumberKey(incoming.numeroFactura ?? ""))
  const hasDate = Boolean(incoming.fechaFactura?.trim())
  const hasAmount = (incoming.total ?? 0) > 0
  if (!hasNumber && !(hasDate && hasAmount)) return null

  const fecha = parseEntryDate(incoming.fechaFactura)
  const commandCode = commandCodeForDocumentType(params.documentType)

  const candidates = await prisma.accountingEntry.findMany({
    where: {
      companyId: params.companyId,
      ...(params.excludeEntryId ? { id: { not: params.excludeEntryId } } : {}),
      OR: [
        ...(fecha ? [{ fecha }] : []),
        { invoiceNumber: { not: null } },
        { commandCode: { in: ["17", "34"] } },
        { commandCode },
      ],
    },
    select: {
      id: true,
      refNumber: true,
      invoiceNumber: true,
      fecha: true,
      invoiceDataJson: true,
      commandCode: true,
      lines: {
        orderBy: { sortOrder: "asc" as const },
        select: { cuenta: true, debe: true, haber: true, concepto: true },
      },
    },
    take: 500,
    orderBy: { createdAt: "desc" },
  })

  const incomingFamily = thirdPartyFamily(incoming.accountCode ?? "", params.documentType)

  const match = candidates.find((entry) => {
    if (params.documentType === "factura-emitida" && entry.commandCode === "34") return false
    if (params.documentType === "factura-recibida" && entry.commandCode === "17") return false
    const stored = probeFromStoredEntry(entry)
    const storedFamily = thirdPartyFamily(
      stored.accountCode ?? "",
      commandTypeFromCode(entry.commandCode),
    )
    if (incomingFamily && storedFamily && incomingFamily !== storedFamily) return false
    return isDuplicateInvoiceSignal(incoming, stored)
  })

  if (!match) return null

  const stored = probeFromStoredEntry(match)
  return {
    entryId: match.id,
    refNumber: match.refNumber,
    invoiceNumber: stored.numeroFactura || match.invoiceNumber || params.invoice.numeroFactura,
    fecha: match.fecha.toISOString().slice(0, 10),
  }
}
