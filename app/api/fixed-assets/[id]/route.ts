import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { updateFixedAsset } from "@/lib/fixed-assets/service"
import type { FixedAssetInput } from "@/lib/types/extended-modules"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as Partial<FixedAssetInput>
    const asset = await updateFixedAsset(companyId, id, body)
    return NextResponse.json({ success: true, asset })
  } catch (error) {
    return authErrorResponse(error)
  }
}
