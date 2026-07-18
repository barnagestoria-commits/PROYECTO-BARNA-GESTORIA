import type { ThirdPartyType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { calculateTotals } from "@/lib/accounting/command-templates"
import { resolveOrCreateThirdParty } from "@/lib/accounting/third-party-service"
import { thirdPartyTypeFromDocumentType } from "@/lib/accounting/third-party-types"
import { calculateTotalFromBreakdown, sumDesglose } from "@/lib/invoice-totals"
import type { InvoiceOcrResult } from "@/lib/types/invoice"
import type { ThirdPartyResolution } from "@/lib/accounting/third-party-types"

export interface InvoiceAccountingResult {
  thirdParty: ThirdPartyResolution
  entryId: string
  commandCode: string
}

function parseInvoiceDate(fechaFactura: string): Date {
  const date = new Date(`${fechaFactura}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de factura no es válida.")
  }
  return date
}

function buildReceivedInvoiceLines(invoice: InvoiceOcrResult, providerAccount: string) {
  const { baseImponible, iva } = sumDesglose(invoice.iva_desglose)
  const recargo = invoice.recargo_equivalencia?.cuota ?? 0
  const totalIva = Math.round((iva + recargo) * 100) / 100
  const total = calculateTotalFromBreakdown(invoice.iva_desglose, invoice.recargo_equivalencia)
  const concept = `Factura ${invoice.numeroFactura} — ${invoice.proveedor}`

  const lines = [
    {
      sortOrder: 0,
      cuenta: providerAccount,
      concepto: `${invoice.proveedor} (${invoice.cif})`,
      debe: 0,
      haber: total,
    },
  ]

  if (totalIva > 0) {
    lines.push({
      sortOrder: lines.length,
      cuenta: "472",
      concepto: `IVA soportado ${invoice.numeroFactura}`,
      debe: totalIva,
      haber: 0,
    })
  }

  lines.push({
    sortOrder: lines.length,
    cuenta: "600",
    concepto: concept,
    debe: baseImponible,
    haber: 0,
  })

  return lines
}

function buildIssuedInvoiceLines(invoice: InvoiceOcrResult, clientAccount: string) {
  const { baseImponible, iva } = sumDesglose(invoice.iva_desglose)
  const total = calculateTotalFromBreakdown(invoice.iva_desglose, invoice.recargo_equivalencia)
  const concept = `Factura ${invoice.numeroFactura} — ${invoice.proveedor}`

  const lines = [
    {
      sortOrder: 0,
      cuenta: clientAccount,
      concepto: `${invoice.proveedor} (${invoice.cif})`,
      debe: total,
      haber: 0,
    },
  ]

  if (iva > 0) {
    lines.push({
      sortOrder: lines.length,
      cuenta: "477",
      concepto: `IVA repercutido ${invoice.numeroFactura}`,
      debe: 0,
      haber: iva,
    })
  }

  lines.push({
    sortOrder: lines.length,
    cuenta: "700",
    concepto: concept,
    debe: 0,
    haber: baseImponible,
  })

  return lines
}

export async function createInvoiceAccountingEntry(params: {
  companyId: string
  createdById: string
  documentType: "factura-recibida" | "factura-emitida"
  invoice: InvoiceOcrResult
}): Promise<InvoiceAccountingResult> {
  const type: ThirdPartyType = thirdPartyTypeFromDocumentType(params.documentType)

  const thirdParty = await resolveOrCreateThirdParty(
    params.companyId,
    type,
    params.invoice.cif,
    params.invoice.proveedor,
  )

  const commandCode = params.documentType === "factura-recibida" ? "34" : "17"
  const lines =
    params.documentType === "factura-recibida"
      ? buildReceivedInvoiceLines(params.invoice, thirdParty.accountCode)
      : buildIssuedInvoiceLines(params.invoice, thirdParty.accountCode)

  const totals = calculateTotals(
    lines.map((line, index) => ({
      id: `tmp-${index}`,
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: line.debe,
      haber: line.haber,
    })),
  )

  if (!totals.isBalanced) {
    throw new Error(
      `No se pudo cuadrar el asiento de la factura (diferencia ${Math.abs(totals.difference).toFixed(2)} €).`,
    )
  }

  const entry = await prisma.accountingEntry.create({
    data: {
      companyId: params.companyId,
      fecha: parseInvoiceDate(params.invoice.fechaFactura),
      commandCode,
      createdById: params.createdById,
      lines: { create: lines },
    },
  })

  return {
    thirdParty,
    entryId: entry.id,
    commandCode,
  }
}
