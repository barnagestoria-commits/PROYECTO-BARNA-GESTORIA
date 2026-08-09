import type { GestoriaEntityType } from "@prisma/client"
import type { GestoriaBankAccount, GestoriaClientProfileDto } from "@/lib/contabilidad/gestoria-client-profile-types"
import {
  formatRegistroMercantilLine,
  hasRegistroMercantil,
  isSociedadMercantil,
} from "@/lib/invoices/registro-mercantil"
import { createDefaultInvoiceTemplate } from "@/lib/invoices/invoice-template-defaults"
import type {
  InvoiceLineItem,
  InvoiceParty,
  InvoicePartyAddress,
  InvoicePdfData,
  InvoicePreviewRequest,
  InvoiceTaxBreakdown,
  InvoiceTemplateConfig,
  RegistroMercantilData,
} from "@/lib/invoices/types"
import {
  buildVerifactuQrCaption,
  buildVerifactuVerificationUrl,
} from "@/lib/invoices/verifactu-qr"
import type { VerifactuEnvironment } from "@/lib/settings/certificate-storage"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"
import { sumInvoiceTotals } from "@/lib/types/invoice-entry-details"

export interface BuildInvoicePdfContext {
  companyName: string
  companyCif: string | null
  profile: GestoriaClientProfileDto | null
  registroMercantil: RegistroMercantilData | null
  template: InvoiceTemplateConfig | null
  verifactuEnvironment: VerifactuEnvironment
  entityType: GestoriaEntityType
}

function formatAddress(profile: GestoriaClientProfileDto | null): InvoicePartyAddress {
  if (!profile) return { lines: [] }
  const street = [profile.streetType, profile.streetName, profile.streetNumber]
    .filter(Boolean)
    .join(" ")
    .trim()
  const locality = [profile.postalCode, profile.city, profile.province].filter(Boolean).join(" ")
  const lines = [street, profile.floor ? `Piso ${profile.floor} Puerta ${profile.door || "—"}` : "", locality]
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    lines,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
  }
}

function pickDefaultBank(bankAccounts: GestoriaBankAccount[]): GestoriaBankAccount | null {
  return bankAccounts.find((account) => account.isDefault) ?? bankAccounts[0] ?? null
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildLineItems(
  invoice: InvoiceEntryDetails,
  descriptions?: string[],
): InvoiceLineItem[] {
  return invoice.vatLines.map((line, index) => {
    const base = line.base || 0
    const vatAmount = line.quota || 0
    return {
      description: descriptions?.[index]?.trim() || `Operación ${index + 1}`,
      quantity: 1,
      unitPrice: base,
      discountPercent: 0,
      base,
      vatPercent: line.vatPercent,
      vatAmount,
      total: Math.round((base + vatAmount) * 100) / 100,
    }
  })
}

function buildTaxBreakdown(invoice: InvoiceEntryDetails): InvoiceTaxBreakdown[] {
  const map = new Map<number, InvoiceTaxBreakdown>()
  for (const line of invoice.vatLines) {
    const current = map.get(line.vatPercent) ?? { vatPercent: line.vatPercent, base: 0, quota: 0 }
    current.base += line.base || 0
    current.quota += line.quota || 0
    map.set(line.vatPercent, current)
  }
  return [...map.values()].map((row) => ({
    vatPercent: row.vatPercent,
    base: Math.round(row.base * 100) / 100,
    quota: Math.round(row.quota * 100) / 100,
  }))
}

function resolveTemplate(config: InvoiceTemplateConfig | null): InvoiceTemplateConfig {
  const defaults = createDefaultInvoiceTemplate()
  if (!config) return defaults
  return {
    ...defaults,
    ...config,
    visibility: { ...defaults.visibility, ...config.visibility },
  }
}

export function buildInvoicePdfData(
  request: InvoicePreviewRequest,
  context: BuildInvoicePdfContext,
): InvoicePdfData {
  const invoice = request.invoice
  const template = resolveTemplate(context.template)
  const totals = sumInvoiceTotals(invoice.vatLines)
  const irpfAmount =
    invoice.applyIrpf && invoice.irpfPercent > 0
      ? Math.round(totals.base * (invoice.irpfPercent / 100) * 100) / 100
      : 0
  const grandTotal = Math.round((totals.total - irpfAmount) * 100) / 100
  const profile = context.profile
  const bank = profile ? pickDefaultBank(profile.bankAccounts) : null
  const sociedad = isSociedadMercantil(context.entityType)
  const registro = sociedad && hasRegistroMercantil(context.registroMercantil)
    ? context.registroMercantil
    : null

  const issuer: InvoiceParty = {
    name: context.companyName,
    taxId: context.companyCif || "—",
    address: formatAddress(profile),
  }

  const recipient: InvoiceParty = {
    name: invoice.thirdPartyName || "Cliente",
    taxId: invoice.nif || "—",
    address: { lines: [] },
  }

  const issuerNif = (context.companyCif || invoice.nif || "").replace(/\s/g, "").toUpperCase()
  const verificationUrl = buildVerifactuVerificationUrl({
    environment: context.verifactuEnvironment,
    issuerNif,
    invoiceNumber: invoice.invoiceNumber || "BORRADOR",
    issueDate: invoice.issueDate,
    totalAmount: grandTotal,
    recordHash: request.verifactuHash,
  })

  return {
    invoiceNumber: invoice.invoiceNumber || "BORRADOR",
    issueDate: invoice.issueDate,
    operationDate: invoice.operationDate,
    isRectificativa: invoice.isRectificativa,
    issuer,
    recipient,
    lineItems: buildLineItems(invoice, request.lineDescriptions),
    taxBreakdown: buildTaxBreakdown(invoice),
    subtotal: totals.base,
    totalVat: totals.quota,
    totalIrpf: irpfAmount,
    grandTotal,
    payment:
      bank?.iban && template.visibility.showIban
        ? {
            iban: bank.iban,
            bankName: bank.bankName,
            dueDate: template.visibility.showDueDates
              ? addDays(invoice.issueDate, template.paymentTermsDays)
              : undefined,
            paymentMethod: "Transferencia bancaria",
          }
        : null,
    registroMercantil: registro,
    registroMercantilLine:
      sociedad && template.visibility.showRegistroMercantil
        ? formatRegistroMercantilLine(registro, profile?.province)
        : null,
    isSociedadMercantil: sociedad,
    template,
    verifactu: {
      environment: context.verifactuEnvironment,
      verificationUrl,
      recordHash: request.verifactuHash?.trim() || "",
      qrCaption: buildVerifactuQrCaption(context.verifactuEnvironment),
    },
    notes: template.visibility.showFooterNotes ? template.footerNotes : undefined,
  }
}

export function parseRegistroMercantilJson(raw: string | null | undefined): RegistroMercantilData | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as RegistroMercantilData
  } catch {
    return null
  }
}

export function parseInvoiceTemplateJson(raw: string | null | undefined): InvoiceTemplateConfig | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as InvoiceTemplateConfig
  } catch {
    return null
  }
}
