import { NextResponse } from "next/server"
import type { DocumentStatus, DocumentType } from "@prisma/client"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { createInvoiceAccountingEntry } from "@/lib/accounting/invoice-entry-service"
import { DuplicateInvoiceError } from "@/lib/accounting/duplicate-invoice"
import { checkAccountExists } from "@/lib/accounting/account-exists-service"
import { getCompanyAccountingSettings } from "@/lib/accounting/analytic-accounting-service"
import { prisma } from "@/lib/db"
import { calculateTotalFromBreakdown } from "@/lib/invoice-totals"
import { parseOcrSettings } from "@/lib/ocr/ocr-settings"
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
  allowDuplicate?: boolean
}

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as ConfirmInvoiceRequest

    if (!body.invoice || !body.fileName || !body.documentType) {
      return NextResponse.json({ success: false, error: "Datos de factura incompletos." }, { status: 400 })
    }

    const settings = await getCompanyAccountingSettings(companyId)
    const ocrSettings = parseOcrSettings(
      settings.ocrSettingsJson,
      settings.ocrBlockDuplicates,
    )

    if (ocrSettings.requireCif && !body.invoice.cif?.trim()) {
      return NextResponse.json(
        { success: false, error: "La configuración OCR exige un NIF/CIF para confirmar." },
        { status: 400 },
      )
    }

    if (ocrSettings.requireTotalsMatch) {
      const calculatedTotal = calculateTotalFromBreakdown(
        body.invoice.iva_desglose,
        body.invoice.recargo_equivalencia,
      )
      if (Math.abs(calculatedTotal - body.invoice.total) >= 0.02) {
        return NextResponse.json(
          {
            success: false,
            error: "La configuración OCR exige que el total calculado cuadre con la factura.",
          },
          { status: 400 },
        )
      }
    }

    const ledgerField =
      body.documentType === "factura-emitida" ? "incomeAccount" : "expenseAccount"
    const ledgerAccount = body.invoice[ledgerField]?.trim()
    if (ledgerAccount) {
      const account = await checkAccountExists(companyId, ledgerAccount)
      if (!account.exists) {
        return NextResponse.json(
          {
            success: false,
            error: `La cuenta ${account.formattedAccountCode} no está dada de alta. Créala antes de confirmar la factura.`,
            code: "ACCOUNT_NOT_REGISTERED",
            account,
          },
          { status: 409 },
        )
      }
      body.invoice = {
        ...body.invoice,
        [ledgerField]: account.formattedAccountCode || ledgerAccount,
      }
    }

    const allowDuplicate = ocrSettings.blockDuplicates ? Boolean(body.allowDuplicate) : true

    const accounting = await createInvoiceAccountingEntry({
      companyId,
      createdById: session.user.id,
      documentType: body.documentType,
      invoice: body.invoice,
      allowDuplicate,
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
    if (error instanceof DuplicateInvoiceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          duplicate: error.duplicate,
        },
        { status: 409 },
      )
    }
    return authErrorResponse(error)
  }
}
