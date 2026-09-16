import { findVatRateTypeByPercent } from "@/lib/accounting/vat-catalog"
import type { InvoiceOcrResult, IvaDesgloseLine } from "@/lib/types/invoice"
import {
  createDefaultInvoiceDetails,
  createEmptyVatLine,
  type InvoiceEntryDetails,
  type InvoiceVatLine,
} from "@/lib/types/invoice-entry-details"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function vatOperationFromOcr(invoice: Partial<InvoiceOcrResult>): string {
  if (invoice.isIntracomunitaria) return "3"
  if (invoice.isSujetoPasivo) return "4"
  return "1"
}

function vatLineFromDesglose(
  line: IvaDesgloseLine,
  operation: string,
  taxForm: string,
): InvoiceVatLine {
  const percent = Number(line.tipo_iva) || 0
  const rate = findVatRateTypeByPercent(percent)
  return {
    id: `vat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    operation,
    base: Number(line.base_imponible) || 0,
    vatType: rate?.code ?? (percent === 0 ? "07" : "04"),
    vatPercent: percent,
    quota: Number(line.cuota_iva) || 0,
    taxForm,
  }
}

export function invoiceDetailsFromOcr(invoice: Partial<InvoiceOcrResult>): InvoiceEntryDetails {
  const fecha = invoice.fechaFactura ?? ""
  const operation = vatOperationFromOcr(invoice)
  const taxForm = invoice.isIntracomunitaria ? "349" : "347"
  const desglose =
    invoice.iva_desglose && invoice.iva_desglose.length > 0
      ? invoice.iva_desglose
      : [
          {
            base_imponible: Number(invoice.baseImponible) || 0,
            tipo_iva: 21,
            cuota_iva: Number(invoice.iva) || 0,
          } satisfies IvaDesgloseLine,
        ]

  const vatLines = desglose.map((line) => vatLineFromDesglose(line, operation, taxForm))

  return {
    invoiceNumber: invoice.numeroFactura ?? "",
    issueDate: fecha,
    operationDate: fecha,
    thirdPartyName: invoice.proveedor ?? "",
    nif: invoice.cif ?? "",
    isRectificativa: false,
    vatLines: vatLines.length > 0 ? vatLines : [createEmptyVatLine()],
    applyIrpf: false,
    irpfPercent: 0,
    irpfAccount: "",
  }
}

function looksLikeOcrInvoice(record: Record<string, unknown>): boolean {
  return Array.isArray(record.iva_desglose) || typeof record.proveedor === "string"
}

function looksLikeInvoiceDetails(record: Record<string, unknown>): boolean {
  return (
    Array.isArray(record.vatLines) ||
    "invoiceNumber" in record ||
    "thirdPartyName" in record ||
    "nif" in record
  )
}

export function ensureInvoiceVatLines(details: InvoiceEntryDetails): InvoiceEntryDetails {
  if (details.vatLines?.length) return details
  return { ...details, vatLines: [createEmptyVatLine()] }
}

export function normalizeInvoiceDetails(value: unknown): InvoiceEntryDetails | null {
  const record = asRecord(value)
  if (!record) return null

  if (Array.isArray(record.vatLines)) {
    const fecha = String(record.issueDate ?? record.operationDate ?? record.fechaFactura ?? "")
    const fallback = createDefaultInvoiceDetails(fecha)
    const vatLines = (record.vatLines as InvoiceVatLine[]).filter(
      (line) => line && typeof line === "object",
    )
    return ensureInvoiceVatLines({
      invoiceNumber: String(record.invoiceNumber ?? record.numeroFactura ?? fallback.invoiceNumber),
      issueDate: String(record.issueDate ?? record.fechaFactura ?? fallback.issueDate),
      operationDate: String(record.operationDate ?? record.fechaFactura ?? fallback.operationDate),
      thirdPartyName: String(record.thirdPartyName ?? record.proveedor ?? fallback.thirdPartyName),
      nif: String(record.nif ?? record.cif ?? fallback.nif),
      isRectificativa: Boolean(record.isRectificativa),
      vatLines,
      applyIrpf: Boolean(record.applyIrpf),
      irpfPercent: Number(record.irpfPercent) || 0,
      irpfAccount: String(record.irpfAccount ?? ""),
    })
  }

  if (looksLikeOcrInvoice(record)) {
    return invoiceDetailsFromOcr(record as Partial<InvoiceOcrResult>)
  }

  if (looksLikeInvoiceDetails(record)) {
    const fecha = String(record.issueDate ?? record.operationDate ?? "")
    return ensureInvoiceVatLines({
      ...createDefaultInvoiceDetails(fecha),
      invoiceNumber: String(record.invoiceNumber ?? ""),
      issueDate: String(record.issueDate ?? fecha),
      operationDate: String(record.operationDate ?? fecha),
      thirdPartyName: String(record.thirdPartyName ?? ""),
      nif: String(record.nif ?? record.cif ?? ""),
      isRectificativa: Boolean(record.isRectificativa),
      applyIrpf: Boolean(record.applyIrpf),
      irpfPercent: Number(record.irpfPercent) || 0,
      irpfAccount: String(record.irpfAccount ?? ""),
    })
  }

  return null
}
