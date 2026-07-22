import { NextResponse } from "next/server"
import type { ThirdPartyType } from "@prisma/client"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  isThirdPartyNewAccountPrefix,
  resolveAccountParentCode,
} from "@/lib/accounting/new-account-prefix"
import {
  previewThirdPartyResolution,
  previewThirdPartyWithPrefix,
} from "@/lib/accounting/third-party-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const cif = url.searchParams.get("cif") ?? ""
    const name = url.searchParams.get("name") ?? ""
    const typeParam = url.searchParams.get("type") ?? "PROVEEDOR"
    const prefixParam = url.searchParams.get("prefix")?.trim() ?? ""

    if (!cif.trim()) {
      return NextResponse.json({ success: false, error: "Indica un NIF/CIF." }, { status: 400 })
    }

    if (prefixParam) {
      const meta = resolveAccountParentCode(prefixParam)
      if (!meta?.isThirdParty || !isThirdPartyNewAccountPrefix(meta.code)) {
        return NextResponse.json(
          { success: false, error: "Prefijo de tercero no válido." },
          { status: 400 },
        )
      }

      const resolution = await previewThirdPartyWithPrefix(
        companyId,
        meta.code,
        cif,
        name,
      )

      return NextResponse.json({ success: true, resolution })
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
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
