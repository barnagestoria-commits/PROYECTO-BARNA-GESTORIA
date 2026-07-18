import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { generateListadosBundleZip } from "@/lib/reports/zip/generate-report-zip"
import { prisma } from "@/lib/db"
import { buildListadosBundleFilename, parseReportQueryFromUrl } from "@/lib/reports/report-query"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const parsed = parseReportQueryFromUrl(new URL(request.url))
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const zipBuffer = await generateListadosBundleZip(
      {
        companyId,
        year: parsed.year,
        fromMonth: parsed.fromMonth,
        toMonth: parsed.toMonth,
      },
      company.name,
    )

    const filename = buildListadosBundleFilename(company.name, parsed.year)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
        "X-Report-Type": "listados-bundle",
        "X-Report-Label": "Listados contables completos",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
