import type { VerifactuEnvironment } from "@/lib/settings/certificate-storage"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"

export type InvoiceTableStyle = "classic" | "minimal" | "striped"

export interface RegistroMercantilData {
  provincia: string
  tomo: string
  libro: string
  folio: string
  hoja: string
  seccion: string
  inscripcion: string
}

export interface InvoiceTemplateVisibility {
  showDueDates: boolean
  showFooterNotes: boolean
  showZeroDiscounts: boolean
  showIban: boolean
  showRegistroMercantil: boolean
}

export interface InvoiceTemplateConfig {
  primaryColor: string
  accentColor: string
  tableStyle: InvoiceTableStyle
  logoDataUrl: string | null
  footerNotes: string
  paymentTermsDays: number
  visibility: InvoiceTemplateVisibility
}

export interface InvoicePartyAddress {
  lines: string[]
  email?: string
  phone?: string
}

export interface InvoiceParty {
  name: string
  taxId: string
  address: InvoicePartyAddress
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  base: number
  vatPercent: number
  vatAmount: number
  total: number
}

export interface InvoiceTaxBreakdown {
  vatPercent: number
  base: number
  quota: number
}

export interface InvoicePaymentInfo {
  iban: string
  bankName?: string
  dueDate?: string
  paymentMethod?: string
}

export interface VerifactuRecord {
  environment: VerifactuEnvironment
  verificationUrl: string
  recordHash: string
  qrCaption: string
}

export interface InvoicePdfData {
  invoiceNumber: string
  series?: string
  issueDate: string
  operationDate: string
  isRectificativa: boolean
  rectificativaRef?: string
  issuer: InvoiceParty
  recipient: InvoiceParty
  lineItems: InvoiceLineItem[]
  taxBreakdown: InvoiceTaxBreakdown[]
  subtotal: number
  totalVat: number
  totalIrpf: number
  grandTotal: number
  payment: InvoicePaymentInfo | null
  registroMercantil: RegistroMercantilData | null
  registroMercantilLine: string | null
  isSociedadMercantil: boolean
  template: InvoiceTemplateConfig
  verifactu: VerifactuRecord | null
  notes?: string
}

export interface InvoicePreviewRequest {
  invoice: InvoiceEntryDetails
  lineDescriptions?: string[]
  verifactuHash?: string
}
