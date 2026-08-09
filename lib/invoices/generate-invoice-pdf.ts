import { createPdfBuffer } from "@/lib/reports/pdf/pdfmake-client"
import { buildInvoicePdfDocument } from "@/lib/invoices/templates/pdfmake-invoice-document"
import { generateQrDataUrl } from "@/lib/invoices/verifactu-qr"
import type { InvoicePdfData } from "@/lib/invoices/types"

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  let qrDataUrl: string | undefined
  if (data.verifactu?.verificationUrl) {
    qrDataUrl = await generateQrDataUrl(data.verifactu.verificationUrl)
  }
  const doc = buildInvoicePdfDocument(data, qrDataUrl)
  return createPdfBuffer(doc)
}

export function buildInvoicePdfFilename(invoiceNumber: string, companyName: string): string {
  const slug = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const number = invoiceNumber.replace(/[^a-zA-Z0-9-]+/g, "-")
  return `Factura-${number}-${slug || "empresa"}.pdf`
}
