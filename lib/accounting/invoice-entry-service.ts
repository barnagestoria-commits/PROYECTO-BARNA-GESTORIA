import type { ThirdPartyType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getNextEntryRefNumber } from "@/lib/accounting/entry-ref-service"
import { calculateTotals } from "@/lib/accounting/command-templates"
import {
  applyInvoiceConceptsToLines,
  buildInvoiceLineConcept,
} from "@/lib/accounting/invoice-entry-concepts"
import { extractPrimaryEuVatId } from "@/lib/fiscal/eu-vat-id"
import { getAccountTreatment } from "@/lib/accounting/account-treatment-service"
import {
  formatAccountCodeDisplay,
  thirdPartyTypeFromDocumentType,
} from "@/lib/accounting/third-party-types"
import {
  findThirdPartyByCif,
  resolveOrCreateThirdParty,
  resolveOrCreateThirdPartyWithPrefix,
} from "@/lib/accounting/third-party-service"
import { loadCompanyPurchaseContext } from "@/lib/accounting/company-purchase-context"
import {
  receivedPrefixFromAccountCode,
  withPurchaseClassification,
} from "@/lib/accounting/invoice-supplier-classification"
import { reassignCompanyAccount } from "@/lib/accounting/account-reassign-service"
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

function finalizeOcrInvoiceLines(
  lines: Array<{
    sortOrder: number
    cuenta: string
    concepto: string
    debe: number
    haber: number
  }>,
  commandCode: "17" | "34",
  invoice: InvoiceOcrResult,
) {
  const euVatId =
    invoice.isIntracomunitaria ? extractPrimaryEuVatId(invoice.cif) ?? undefined : undefined

  return applyInvoiceConceptsToLines(lines, commandCode, {
    invoiceNumber: invoice.numeroFactura,
    thirdPartyLabel: invoice.proveedor,
    invoiceMode: commandCode === "17" ? "emitida" : "recibida",
    nif: invoice.cif,
    euVatId: euVatId ?? undefined,
  })
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

  return finalizeOcrInvoiceLines(lines, "34", invoice)
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

  return finalizeOcrInvoiceLines(lines, "17", invoice)
}

export async function createInvoiceAccountingEntry(params: {
  companyId: string
  createdById: string
  documentType: "factura-recibida" | "factura-emitida"
  invoice: InvoiceOcrResult
}): Promise<InvoiceAccountingResult> {
  if (params.documentType === "factura-emitida") {
    const type: ThirdPartyType = thirdPartyTypeFromDocumentType(params.documentType)
    const thirdParty = await resolveOrCreateThirdParty(
      params.companyId,
      type,
      params.invoice.cif,
      params.invoice.proveedor,
    )
    const treatment = await getAccountTreatment(params.companyId, thirdParty.accountCode)
    const defaultIncomeAccount = treatment?.defaultCounterpartAccount
      ? formatAccountCodeDisplay(treatment.defaultCounterpartAccount)
      : "700"
    const lines = buildIssuedInvoiceLines(params.invoice, thirdParty.accountCode, defaultIncomeAccount)
    return persistInvoiceEntry(params, thirdParty, "17", lines)
  }

  const purchaseContext = await loadCompanyPurchaseContext(params.companyId)
  const invoice = withPurchaseClassification(params.invoice, {
    activities: purchaseContext.activities,
    entityType: purchaseContext.entityType,
  })
  const preferred = invoice.preferredAccountCode?.trim() || undefined
  const prefixFromPreferred = preferred
    ? receivedPrefixFromAccountCode(preferred.replace(/\D/g, ""))
    : null
  const prefix =
    prefixFromPreferred ??
    (invoice.accountPrefix === "400" || invoice.accountPrefix === "410" ? invoice.accountPrefix : "410")
  const existingSupplier = await findThirdPartyByCif(params.companyId, "PROVEEDOR", invoice.cif)
  let thirdParty = existingSupplier
    ? await resolveOrCreateThirdParty(params.companyId, "PROVEEDOR", invoice.cif, invoice.proveedor)
    : await resolveOrCreateThirdPartyWithPrefix(
        params.companyId,
        prefix,
        invoice.cif,
        invoice.proveedor,
        preferred,
      )

  if (existingSupplier && preferred) {
    const reassigned = await reassignCompanyAccount(params.companyId, {
      fromAccountCode: thirdParty.accountCode,
      toAccountCode: preferred,
      name: invoice.proveedor,
    })
    thirdParty = {
      ...thirdParty,
      accountCode: reassigned.accountCode,
      formattedAccountCode: reassigned.formattedAccountCode,
    }
  }

  const treatment = await getAccountTreatment(params.companyId, thirdParty.accountCode)
  const defaultExpenseAccount = params.invoice.expenseAccount?.trim()
    ? formatAccountCodeDisplay(params.invoice.expenseAccount)
    : treatment?.defaultCounterpartAccount
      ? formatAccountCodeDisplay(treatment.defaultCounterpartAccount)
      : formatAccountCodeDisplay(invoice.expenseAccount || "629")

  const lines = buildReceivedInvoiceLines(invoice, thirdParty.accountCode, defaultExpenseAccount)
  return persistInvoiceEntry(params, thirdParty, "34", lines)
}

async function persistInvoiceEntry(
  params: {
    companyId: string
    createdById: string
    invoice: InvoiceOcrResult
  },
  thirdParty: ThirdPartyResolution,
  commandCode: "17" | "34",
  lines: ReturnType<typeof buildReceivedInvoiceLines>,
): Promise<InvoiceAccountingResult> {
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
