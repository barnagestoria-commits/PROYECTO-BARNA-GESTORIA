import { NextResponse } from "next/server"
import type { ThirdPartyType } from "@prisma/client"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { previewThirdPartyResolution } from "@/lib/accounting/third-party-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const cif = url.searchParams.get("cif") ?? ""
    const name = url.searchParams.get("name") ?? ""
    const typeParam = url.searchParams.get("type") ?? "PROVEEDOR"

    if (!cif.trim()) {
      return NextResponse.json({ success: false, error: "Indica un NIF/CIF." }, { status: 400 })
    }

    if (typeParam !== "PROVEEDOR" && typeParam !== "CLIENTE") {
      return NextResponse.json({ success: false, error: "Tipo de tercero no válido." }, { status: 400 })
    }

    const resolution = await previewThirdPartyResolution(
      companyId,
      typeParam as ThirdPartyType,
      cif,
      name,
    )

    return NextResponse.json({ success: true, resolution })
  } catch (error) {
    return authErrorResponse(error)
  }
}
