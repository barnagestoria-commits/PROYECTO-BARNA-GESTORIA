import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { createFixedAsset, listFixedAssets } from "@/lib/fixed-assets/service"
import type { FixedAssetInput } from "@/lib/types/extended-modules"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const assets = await listFixedAssets(companyId)
    return NextResponse.json({ success: true, assets })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as FixedAssetInput
    const asset = await createFixedAsset(companyId, body)
    return NextResponse.json({ success: true, asset })
  } catch (error) {
    return authErrorResponse(error)
  }
}
