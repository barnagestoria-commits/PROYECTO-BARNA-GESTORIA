import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { profileRecordToDto } from "@/lib/contabilidad/gestoria-client-profile-serializers"
import { prisma } from "@/lib/db"
import { getOrCreateCompanyFiscalSettings } from "@/lib/fiscal/fiscal-settings-service"
import {
  buildInvoicePdfData,
  parseInvoiceTemplateJson,
  parseRegistroMercantilJson,
} from "@/lib/invoices/build-invoice-pdf-data"
import { buildInvoicePdfFilename, generateInvoicePdf } from "@/lib/invoices/generate-invoice-pdf"
import type { InvoicePreviewRequest, InvoiceTemplateConfig } from "@/lib/invoices/types"
import type { VerifactuEnvironment } from "@/lib/settings/certificate-storage"
import { createDefaultInvoiceDetails } from "@/lib/types/invoice-entry-details"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as InvoicePreviewRequest & { template?: InvoiceTemplateConfig }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        gestoriaProfile: true,
        digitalCertificate: true,
      },
    })
    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const fiscalSettings = await getOrCreateCompanyFiscalSettings(companyId)
    const profileDto = company.gestoriaProfile
      ? profileRecordToDto(company.gestoriaProfile, fiscalSettings)
      : null

    const invoice = body.invoice ?? createDefaultInvoiceDetails(new Date().toISOString().slice(0, 10))
    const environment = (company.digitalCertificate?.environment ?? "sandbox") as VerifactuEnvironment

    const pdfData = buildInvoicePdfData(body, {
      companyName: company.name,
      companyCif: company.cif,
      profile: profileDto,
      registroMercantil: parseRegistroMercantilJson(company.gestoriaProfile?.registroMercantilJson),
      template: body.template ?? parseInvoiceTemplateJson(company.gestoriaProfile?.invoiceTemplateJson),
      verifactuEnvironment: environment,
      entityType: company.gestoriaProfile?.entityType ?? "PERSONA_JURIDICA",
    })

    const buffer = await generateInvoicePdf(pdfData)
    const filename = buildInvoicePdfFilename(pdfData.invoiceNumber, company.name)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
