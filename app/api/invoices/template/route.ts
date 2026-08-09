import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { prisma } from "@/lib/db"
import { parseInvoiceTemplateJson } from "@/lib/invoices/build-invoice-pdf-data"
import { createDefaultInvoiceTemplate } from "@/lib/invoices/invoice-template-defaults"
import type { InvoiceTemplateConfig } from "@/lib/invoices/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const profile = await prisma.companyGestoriaProfile.findUnique({ where: { companyId } })
    const template = parseInvoiceTemplateJson(profile?.invoiceTemplateJson) ?? createDefaultInvoiceTemplate()
    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as InvoiceTemplateConfig
    const current = await prisma.companyGestoriaProfile.findUnique({ where: { companyId } })
    const defaults = createDefaultInvoiceTemplate()
    const merged: InvoiceTemplateConfig = {
      ...defaults,
      ...(parseInvoiceTemplateJson(current?.invoiceTemplateJson) ?? {}),
      ...body,
      visibility: {
        ...defaults.visibility,
        ...(parseInvoiceTemplateJson(current?.invoiceTemplateJson)?.visibility ?? {}),
        ...body.visibility,
      },
    }

    await prisma.companyGestoriaProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        clientCode: companyId.slice(-8).toUpperCase(),
        invoiceTemplateJson: JSON.stringify(merged),
      },
      update: { invoiceTemplateJson: JSON.stringify(merged) },
    })

    return NextResponse.json({ success: true, data: merged })
  } catch (error) {
    return authErrorResponse(error)
  }
}
