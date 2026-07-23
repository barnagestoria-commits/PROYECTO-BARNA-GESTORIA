import type { ThirdPartyType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getNextEntryRefNumber } from "@/lib/accounting/entry-ref-service"
import { calculateTotals } from "@/lib/accounting/command-templates"
import { buildInvoiceLineConcept } from "@/lib/accounting/invoice-entry-concepts"
import { getAccountTreatment } from "@/lib/accounting/account-treatment-service"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
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

function buildReceivedInvoiceLines(
  invoice: InvoiceOcrResult,
  providerAccount: string,
  expenseAccount = "600",
) {
  const { baseImponible, iva } = sumDesglose(invoice.iva_desglose)
  const recargo = invoice.recargo_equivalencia?.cuota ?? 0
  const totalIva = Math.round((iva + recargo) * 100) / 100
  const total = calculateTotalFromBreakdown(invoice.iva_desglose, invoice.recargo_equivalencia)
  const concept = buildInvoiceLineConcept("34", invoice.numeroFactura)

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
      concepto: buildInvoiceLineConcept("34", invoice.numeroFactura),
      debe: totalIva,
      haber: 0,
    })
  }

  lines.push({
    sortOrder: lines.length,
    cuenta: expenseAccount.replace(/\./g, ""),
    concepto: concept,
    debe: baseImponible,
    haber: 0,
  })

  return lines
}

function buildIssuedInvoiceLines(
  invoice: InvoiceOcrResult,
  clientAccount: string,
  incomeAccount = "700",
) {
  const { baseImponible, iva } = sumDesglose(invoice.iva_desglose)
  const total = calculateTotalFromBreakdown(invoice.iva_desglose, invoice.recargo_equivalencia)
  const concept = buildInvoiceLineConcept("17", invoice.numeroFactura)

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
      concepto: buildInvoiceLineConcept("17", invoice.numeroFactura),
      debe: 0,
      haber: iva,
    })
  }

  lines.push({
    sortOrder: lines.length,
    cuenta: incomeAccount.replace(/\./g, ""),
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

  const treatment = await getAccountTreatment(params.companyId, thirdParty.accountCode)
  const defaultExpenseAccount = treatment?.defaultCounterpartAccount
    ? formatAccountCodeDisplay(treatment.defaultCounterpartAccount)
    : "600"
  const defaultIncomeAccount = treatment?.defaultCounterpartAccount
    ? formatAccountCodeDisplay(treatment.defaultCounterpartAccount)
    : "700"

  const commandCode = params.documentType === "factura-recibida" ? "34" : "17"
  const lines =
    params.documentType === "factura-recibida"
      ? buildReceivedInvoiceLines(params.invoice, thirdParty.accountCode, defaultExpenseAccount)
      : buildIssuedInvoiceLines(params.invoice, thirdParty.accountCode, defaultIncomeAccount)

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

  const refNumber = await getNextEntryRefNumber(params.companyId)

  const entry = await prisma.accountingEntry.create({
    data: {
      companyId: params.companyId,
      refNumber,
      fecha: parseInvoiceDate(params.invoice.fechaFactura),
      issueDate: parseInvoiceDate(params.invoice.fechaFactura),
      operationDate: parseInvoiceDate(params.invoice.fechaFactura),
      invoiceNumber: params.invoice.numeroFactura,
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
