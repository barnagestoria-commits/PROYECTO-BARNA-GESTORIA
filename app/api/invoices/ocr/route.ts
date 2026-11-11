import { NextResponse } from "next/server"
import { extractInvoiceData } from "@/lib/ocr/extract-invoice"
import { OcrConfigError, OcrExtractionError, OcrQuotaError } from "@/lib/ocr/errors"
import type { InvoiceOcrErrorResponse, InvoiceOcrResponse } from "@/lib/types/invoice"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { loadCompanyPurchaseContext } from "@/lib/accounting/company-purchase-context"
import {
  withIssuedClassification,
  withPurchaseClassification,
} from "@/lib/accounting/invoice-supplier-classification"
import { OCR_QUOTA_CODE } from "@/lib/ocr/ocr-quota"
import {
  assertOcrInvoiceQuota,
  getOcrInvoiceUsage,
  recordOcrInvoiceUsage,
} from "@/lib/ocr/ocr-quota-service"
import { deleteStoredObject, putCompanyObject } from "@/lib/storage/object-storage"
import { assertUploadSize, UPLOAD_LIMITS_BYTES } from "@/lib/storage/upload-limits"

export const runtime = "nodejs"
export const maxDuration = 180

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"]

export async function GET(request: Request) {
  try {
    const { session } = await requireActiveCompany(request)
    const usage = await getOcrInvoiceUsage(session.user.accountId)
    return NextResponse.json({ success: true, usage })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse.status !== 500) {
      const body = await authResponse.json()
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: body.error ?? "Error de autenticación." },
        { status: authResponse.status },
      )
    }

    console.error("[invoices/ocr:usage]", error)
    return NextResponse.json<InvoiceOcrErrorResponse>(
      { success: false, error: "No se pudo consultar la prueba de OCR." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let accountId: string | null = null
  try {
    const { companyId, session } = await requireActiveCompany(request)
    accountId = session.user.accountId
    await assertOcrInvoiceQuota(accountId)

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

    try {
      assertUploadSize(file.size, UPLOAD_LIMITS_BYTES.invoice, "El archivo")
    } catch (error) {
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: error instanceof Error ? error.message : "Archivo demasiado grande." },
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

    const documentTypeRaw = String(formData.get("documentType") ?? "factura-recibida")
    const documentType =
      documentTypeRaw === "factura-emitida" ? "factura-emitida" : "factura-recibida"

    const buffer = Buffer.from(await file.arrayBuffer())
    const stored = await putCompanyObject({
      companyId,
      kind: "documents",
      fileName: file.name,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    })

    let invoices
    try {
      invoices = await extractInvoiceData({
        buffer,
        mimeType: file.type,
        fileName: file.name,
        documentType,
      })
    } catch (error) {
      await deleteStoredObject(stored.storageKey)
      throw error
    }
    const purchaseContext = await loadCompanyPurchaseContext(companyId)
    const classifiedInvoices = invoices.map((invoice) =>
      documentType === "factura-emitida"
        ? withIssuedClassification(invoice, {
            fileName: file.name,
            activities: purchaseContext.activities,
            entityType: purchaseContext.entityType,
          })
        : withPurchaseClassification(invoice, {
            fileName: file.name,
            activities: purchaseContext.activities,
            entityType: purchaseContext.entityType,
          }),
    )
    const usage = await recordOcrInvoiceUsage(accountId, classifiedInvoices.length)

    return NextResponse.json<InvoiceOcrResponse>({
      success: true,
      data: classifiedInvoices[0],
      invoices: classifiedInvoices,
      fileName: file.name,
      companyId,
      processedAt: new Date().toISOString(),
      usage,
      storageKey: stored.storageKey,
      sha256: stored.sha256,
      contentType: stored.contentType,
    })
  } catch (error) {
    if (error instanceof OcrQuotaError) {
      const usage = accountId ? await getOcrInvoiceUsage(accountId).catch(() => undefined) : undefined
      return NextResponse.json<InvoiceOcrErrorResponse>(
        { success: false, error: error.message, code: OCR_QUOTA_CODE, usage },
        { status: 402 },
      )
    }

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

    const message =
      error instanceof Error ? error.message : "Error al procesar la factura. Inténtalo de nuevo."

    return NextResponse.json<InvoiceOcrErrorResponse>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
