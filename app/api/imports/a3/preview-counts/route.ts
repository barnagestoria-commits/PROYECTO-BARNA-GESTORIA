import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { previewCountsForParsedA3 } from "@/lib/imports/a3/a3-import-service"
import type { A3FixedAsset, A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"
import type { A3VendorRef } from "@/lib/imports/a3/a3-client-import"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

interface PreviewCountsBody {
  companyId?: string
  subaccounts: A3Subaccount[]
  thirdParties: A3ThirdParty[]
  vendorRefs: A3VendorRef[]
  fixedAssets?: A3FixedAsset[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewCountsBody
    const { companyId } = await resolveImportCompanyFromBody(request, body)

    const subaccounts = Array.isArray(body.subaccounts) ? body.subaccounts : []
    const thirdParties = Array.isArray(body.thirdParties) ? body.thirdParties : []
    const vendorRefs = Array.isArray(body.vendorRefs) ? body.vendorRefs : []
    const fixedAssets = Array.isArray(body.fixedAssets) ? body.fixedAssets : []

    const counts = await previewCountsForParsedA3(
      companyId,
      subaccounts,
      thirdParties,
      vendorRefs,
      fixedAssets,
    )

    return NextResponse.json({
      success: true,
      counts,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
