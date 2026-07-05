import { NextResponse } from "next/server"
import { extractInvoiceData } from "@/lib/ocr/extract-invoice"
import { OcrConfigError, OcrExtractionError } from "@/lib/ocr/errors"
import type { InvoiceOcrErrorResponse, InvoiceOcrResponse } from "@/lib/types/invoice"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"

export const runtime = "nodejs"
export const maxDuration = 60

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)

    const formData = await request.formData()
    const file = formData.get("file")
    const formCompanyId = formData.get("companyId")

    if (formCompanyId && String(formCompanyId) !== companyId) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: "La empresa del archivo no coincide con la empresa activa." },
        { status: 403 },
      )
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: "No se ha proporcionado ningún archivo." },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: "El archivo supera el tamaño máximo de 10 MB." },
        { status: 400 },
      )
    }

    const isAllowedType =
      ALLOWED_TYPES.includes(file.type) ||
      [".pdf", ".jpg", ".jpeg", ".png"].some((ext) => file.name.toLowerCase().endsWith(ext))

    if (!isAllowedType) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: "Formato no soportado. Usa PDF, JPG o PNG." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await extractInvoiceData({
      buffer,
      mimeType: file.type,
      fileName: file.name,
    })

    return NextResponse.json<InvoiceOcrResponse>({
      success: true,
      data,
      fileName: file.name,
      companyId,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof OcrConfigError) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: error.message },
        { status: 503 },
      )
    }

    if (error instanceof OcrExtractionError) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: error.message },
        { status: 422 },
      )
    }

    const authResponse = authErrorResponse(error)
    if (authResponse.status !== 500) {
      const body = await authResponse.json()
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: body.error ?? "Error de autenticación." },
        { status: authResponse.status },
      )
    }

    console.error("[invoices/ocr]", error)

    return NextResponse.json<InvoiceOcrErrorResponse>(
      { success: false, error: "Error al procesar la factura. Inténtalo de nuevo." },
      { status: 500 },
    )
  }
}
