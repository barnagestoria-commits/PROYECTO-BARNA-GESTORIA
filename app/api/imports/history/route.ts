import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { prisma } from "@/lib/db"
import {
  decodeImportFormatLabel,
  formatSourceFormatLabel,
} from "@/lib/imports/accounting-formats"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50)

    const imports = await prisma.accountingDataImport.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      imports: imports.map((item) => {
        const decoded = decodeImportFormatLabel(item.format)
        return {
          id: item.id,
          fileName: item.fileName,
          sourceFormat: decoded.sourceFormat,
          sourceFormatLabel: formatSourceFormatLabel(decoded.sourceFormat),
          fileFormat: decoded.fileFormat,
          status: item.status,
          rowsImported: item.rowsImported,
          errorMessage: item.errorMessage,
          createdAt: item.createdAt.toISOString(),
        }
      }),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
