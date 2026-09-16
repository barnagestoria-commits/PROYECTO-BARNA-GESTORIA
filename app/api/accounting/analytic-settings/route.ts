import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  getCompanyAccountingSettings,
  upsertCompanyAccountingSettings,
} from "@/lib/accounting/analytic-accounting-service"
import {
  serializeOcrSettings,
  validateOcrShortcuts,
  type OcrWorkspaceSettings,
} from "@/lib/ocr/ocr-settings"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const settings = await getCompanyAccountingSettings(companyId)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      analyticAccountingEnabled?: boolean
      ocrBlockDuplicates?: boolean
      ocrSettingsJson?: string | null
      ocr?: OcrWorkspaceSettings
    }

    let ocrSettingsJson = body.ocrSettingsJson
    let ocrBlockDuplicates = body.ocrBlockDuplicates

    if (body.ocr) {
      const shortcutError = validateOcrShortcuts(body.ocr.shortcuts)
      if (shortcutError) {
        return NextResponse.json({ success: false, error: shortcutError }, { status: 400 })
      }
      ocrSettingsJson = serializeOcrSettings(body.ocr)
      ocrBlockDuplicates = body.ocr.blockDuplicates
    }

    const settings = await upsertCompanyAccountingSettings(companyId, {
      ...(body.analyticAccountingEnabled !== undefined
        ? { analyticAccountingEnabled: Boolean(body.analyticAccountingEnabled) }
        : {}),
      ...(ocrBlockDuplicates !== undefined ? { ocrBlockDuplicates: Boolean(ocrBlockDuplicates) } : {}),
      ...(ocrSettingsJson !== undefined ? { ocrSettingsJson } : {}),
    })
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
