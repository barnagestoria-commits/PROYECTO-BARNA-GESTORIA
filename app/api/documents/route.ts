import { NextResponse } from "next/server"
import type { DocumentStatus, DocumentType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireActiveCompany, requireRequestSession } from "@/lib/auth/api-auth"
import type { InvoiceOcrResult } from "@/lib/types/invoice"
import {
  assertCompanyStorageKey,
  putCompanyObject,
} from "@/lib/storage/object-storage"
import { assertUploadSize, UPLOAD_LIMITS_BYTES } from "@/lib/storage/upload-limits"

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

function toClientDocument(doc: {
  id: string
  companyId: string
  name: string
  type: DocumentType
  status: DocumentStatus
  sizeBytes: number
  ocrDataJson: string | null
  uploadedAt: Date
  storageKey: string | null
}, ocrData?: InvoiceOcrResult) {
  return {
    id: doc.id,
    companyId: doc.companyId,
    name: doc.name,
    type: mapDocumentTypeToClient(doc.type),
    date: doc.uploadedAt.toISOString().split("T")[0],
    status: doc.status === "PROCESADO" ? "procesado" : "pendiente",
    size: `${Math.round(doc.sizeBytes / 1024)} KB`,
    ocrData: ocrData ?? (doc.ocrDataJson ? (JSON.parse(doc.ocrDataJson) as InvoiceOcrResult) : undefined),
    hasOriginal: Boolean(doc.storageKey),
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
      documents: documents.map((doc) => toClientDocument(doc)),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const contentType = request.headers.get("content-type") ?? ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const companyId = String(formData.get("companyId") ?? session.activeCompanyId ?? "")
      const file = formData.get("file")
      const type = String(formData.get("type") ?? "")
      const statusRaw = String(formData.get("status") ?? "pendiente")
      const ocrRaw = formData.get("ocrData")

      if (!companyId) {
        return NextResponse.json({ success: false, error: "Empresa no especificada." }, { status: 400 })
      }
      if (!session.companies.some((company) => company.id === companyId)) {
        return NextResponse.json({ success: false, error: "Sin acceso a la empresa." }, { status: 403 })
      }
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "Adjunta el archivo. El original se guarda en el almacén de objetos." },
          { status: 400 },
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      assertUploadSize(buffer.length, UPLOAD_LIMITS_BYTES.document, "El documento")
      const stored = await putCompanyObject({
        companyId,
        kind: "documents",
        fileName: file.name,
        body: buffer,
        contentType: file.type || "application/octet-stream",
      })

      let ocrData: InvoiceOcrResult | undefined
      if (typeof ocrRaw === "string" && ocrRaw.trim()) {
        ocrData = JSON.parse(ocrRaw) as InvoiceOcrResult
      }

      const document = await prisma.fiscalDocument.create({
        data: {
          companyId,
          name: file.name,
          type: mapDocumentType(type),
          status: (statusRaw.toUpperCase() === "PROCESADO" ? "PROCESADO" : "PENDIENTE") as DocumentStatus,
          sizeBytes: stored.byteSize,
          ocrDataJson: ocrData ? JSON.stringify(ocrData) : null,
          uploadedById: session.user.id,
          storageKey: stored.storageKey,
          contentType: stored.contentType,
          sha256: stored.sha256,
        },
      })

      return NextResponse.json({
        success: true,
        document: toClientDocument(document, ocrData),
      })
    }

    const body = await request.json()
    const companyId = body.companyId ?? session.activeCompanyId
    if (!companyId) {
      return NextResponse.json({ success: false, error: "Empresa no especificada." }, { status: 400 })
    }

    if (!session.companies.some((company) => company.id === companyId)) {
      return NextResponse.json({ success: false, error: "Sin acceso a la empresa." }, { status: 403 })
    }

    if (!body.storageKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Adjunta el archivo. El original se guarda en el almacén de objetos, no en la base de datos.",
        },
        { status: 400 },
      )
    }

    assertCompanyStorageKey(companyId, String(body.storageKey), "documents")

    const document = await prisma.fiscalDocument.create({
      data: {
        companyId,
        name: body.name,
        type: mapDocumentType(body.type),
        status: (body.status?.toUpperCase() ?? "PENDIENTE") as DocumentStatus,
        sizeBytes: body.sizeBytes ?? 0,
        ocrDataJson: body.ocrData ? JSON.stringify(body.ocrData) : null,
        uploadedById: session.user.id,
        storageKey: String(body.storageKey),
        contentType: body.contentType ?? null,
        sha256: body.sha256 ?? null,
      },
    })

    return NextResponse.json({
      success: true,
      document: toClientDocument(document, body.ocrData),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
