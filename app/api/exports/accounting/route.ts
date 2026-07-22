import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  ACCOUNTING_FORMAT_PROFILES,
  type AccountingSourceFormat,
} from "@/lib/imports/accounting-formats"
import { exportAccountingEntries } from "@/lib/exports/accounting-export"

export const runtime = "nodejs"

function parseSourceFormat(value: string | null): AccountingSourceFormat {
  if (value && ACCOUNTING_FORMAT_PROFILES.some((profile) => profile.id === value)) {
    return value as AccountingSourceFormat
  }
  return "generic"
}

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const { searchParams } = new URL(request.url)
    const sourceFormat = parseSourceFormat(searchParams.get("format"))
    const fileType = searchParams.get("fileType") === "xlsx" ? "xlsx" : "csv"
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined

    const result = await exportAccountingEntries({
      companyId,
      sourceFormat,
      from,
      to,
    })

    if (fileType === "xlsx") {
      return new NextResponse(new Uint8Array(result.xlsx.buffer), {
        headers: {
          "Content-Type": result.xlsx.mimeType,
          "Content-Disposition": `attachment; filename="${result.xlsx.fileName}"`,
          "X-Rows-Exported": String(result.rowsExported),
        },
      })
    }

    return new NextResponse(result.csv.content, {
      headers: {
        "Content-Type": result.csv.mimeType,
        "Content-Disposition": `attachment; filename="${result.csv.fileName}"`,
        "X-Rows-Exported": String(result.rowsExported),
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
