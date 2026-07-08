import { NextResponse } from "next/server"
import type { DocumentStatus, DocumentType } from "@prisma/client"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { createInvoiceAccountingEntry } from "@/lib/accounting/invoice-entry-service"
import { prisma } from "@/lib/db"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

function mapDocumentType(type: string): DocumentType {
  switch (type) {
    case "factura-recibida":
      return "FACTURA_RECIBIDA"
    case "factura-emitida":
      return "FACTURA_EMITIDA"
    default:
      throw new Error("Solo se pueden contabilizar facturas recibidas o emitidas.")
  }
}

interface ConfirmInvoiceRequest {
  fileName: string
  sizeBytes: number
  documentType: "factura-recibida" | "factura-emitida"
  invoice: InvoiceOcrResult
}

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as ConfirmInvoiceRequest

    if (!body.invoice || !body.fileName || !body.documentType) {
      return NextResponse.json({ success: false, error: "Datos de factura incompletos." }, { status: 400 })
    }

    const accounting = await createInvoiceAccountingEntry({
      companyId,
      createdById: session.user.id,
      documentType: body.documentType,
      invoice: body.invoice,
    })

    const document = await prisma.fiscalDocument.create({
      data: {
        companyId,
        name: body.fileName,
        type: mapDocumentType(body.documentType),
        status: "PROCESADO" as DocumentStatus,
        sizeBytes: body.sizeBytes ?? 0,
        ocrDataJson: JSON.stringify(body.invoice),
        uploadedById: session.user.id,
        accountingEntryId: accounting.entryId,
      },
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        type: body.documentType,
        status: "procesado",
      },
      accounting: {
        entryId: accounting.entryId,
        commandCode: accounting.commandCode,
        thirdParty: accounting.thirdParty,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
