import type { InvoiceTemplateConfig } from "@/lib/invoices/types"

export const DEFAULT_INVOICE_PRIMARY = "#145A32"
export const DEFAULT_INVOICE_ACCENT = "#0F3D2E"

export function createDefaultInvoiceTemplate(): InvoiceTemplateConfig {
  return {
    primaryColor: DEFAULT_INVOICE_PRIMARY,
    accentColor: DEFAULT_INVOICE_ACCENT,
    tableStyle: "striped",
    logoDataUrl: null,
    footerNotes:
      "De conformidad con el RD 1619/2012, esta factura contiene todos los requisitos legales de contenido.",
    paymentTermsDays: 30,
    visibility: {
      showDueDates: true,
      showFooterNotes: true,
      showZeroDiscounts: false,
      showIban: true,
      showRegistroMercantil: true,
    },
  }
}
