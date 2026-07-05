import { NextResponse } from "next/server"
import type { DocumentStatus, DocumentType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireActiveCompany, requireRequestSession } from "@/lib/auth/api-auth"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

function mapDocumentType(type: string): DocumentType {
  switch (type) {
    case "factura-recibida":
      return "FACTURA_RECIBIDA"
    case "factura-emitida":
      return "FACTURA_EMITIDA"
    case "extracto-bancario":
      return "EXTRACTO_BANCARIO"
    default:
      throw new Error("Tipo de documento no válido.")
  }
}

function mapDocumentTypeToClient(type: DocumentType): string {
  switch (type) {
    case "FACTURA_RECIBIDA":
      return "factura-recibida"
    case "FACTURA_EMITIDA":
      return "factura-emitida"
    case "EXTRACTO_BANCARIO":
      return "extracto-bancario"
  }
}

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)

    const documents = await prisma.fiscalDocument.findMany({
      where: { companyId },
      orderBy: { uploadedAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      documents: documents.map((doc) => ({
        id: doc.id,
        companyId: doc.companyId,
        name: doc.name,
        type: mapDocumentTypeToClient(doc.type),
        date: doc.uploadedAt.toISOString().split("T")[0],
        status: doc.status === "PROCESADO" ? "procesado" : "pendiente",
        size: `${Math.round(doc.sizeBytes / 1024)} KB`,
        ocrData: doc.ocrDataJson ? (JSON.parse(doc.ocrDataJson) as InvoiceOcrResult) : undefined,
      })),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const body = await request.json()

    const companyId = body.companyId ?? session.activeCompanyId
    if (!companyId) {
      return NextResponse.json({ success: false, error: "Empresa no especificada." }, { status: 400 })
    }

    if (!session.companies.some((company) => company.id === companyId)) {
      return NextResponse.json({ success: false, error: "Sin acceso a la empresa." }, { status: 403 })
    }

    const document = await prisma.fiscalDocument.create({
      data: {
        companyId,
        name: body.name,
        type: mapDocumentType(body.type),
        status: (body.status?.toUpperCase() ?? "PENDIENTE") as DocumentStatus,
        sizeBytes: body.sizeBytes ?? 0,
        ocrDataJson: body.ocrData ? JSON.stringify(body.ocrData) : null,
        uploadedById: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        companyId: document.companyId,
        name: document.name,
        type: mapDocumentTypeToClient(document.type),
        date: document.uploadedAt.toISOString().split("T")[0],
        status: document.status === "PROCESADO" ? "procesado" : "pendiente",
        size: `${Math.round(document.sizeBytes / 1024)} KB`,
        ocrData: body.ocrData,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
