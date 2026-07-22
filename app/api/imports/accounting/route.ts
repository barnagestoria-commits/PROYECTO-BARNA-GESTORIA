import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { importAccountingFile } from "@/lib/imports/accounting-import"
import {
  ACCOUNTING_FORMAT_PROFILES,
  type AccountingSourceFormat,
} from "@/lib/imports/accounting-formats"
import { detectAccountingFileFormat } from "@/lib/imports/parse-accounting-file"

export const runtime = "nodejs"

const ALLOWED_EXTENSIONS = new Set(["csv", "txt", "xlsx", "xls"])

function parseSourceFormat(value: FormDataEntryValue | null): AccountingSourceFormat {
  const raw = String(value ?? "generic")
  if (ACCOUNTING_FORMAT_PROFILES.some((profile) => profile.id === raw)) {
    return raw as AccountingSourceFormat
  }
  return "generic"
}

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const formData = await request.formData()
    const file = formData.get("file")
    const sourceFormat = parseSourceFormat(formData.get("sourceFormat"))

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const extension = file.name.toLowerCase().split(".").pop() ?? ""
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato no soportado. Usa CSV, XLSX o XLS.",
        },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await importAccountingFile(
      companyId,
      file.name,
      buffer,
      session.user.id,
      sourceFormat,
    )

    return NextResponse.json({
      success: true,
      import: {
        ...result,
        format: detectAccountingFileFormat(file.name),
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
