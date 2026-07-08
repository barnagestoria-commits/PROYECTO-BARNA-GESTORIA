import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { createCostCenter, listCostCenters } from "@/lib/fixed-assets/service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const costCenters = await listCostCenters(companyId)
    return NextResponse.json({ success: true, costCenters })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = await request.json()
    const costCenter = await createCostCenter(companyId, body.code, body.name)
    return NextResponse.json({ success: true, costCenter })
  } catch (error) {
    return authErrorResponse(error)
  }
}
