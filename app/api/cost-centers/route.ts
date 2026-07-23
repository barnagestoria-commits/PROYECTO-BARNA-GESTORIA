import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { createCostCenter, deactivateCostCenter, listCostCenters } from "@/lib/fixed-assets/service"

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

export async function PATCH(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as { id?: string; isActive?: boolean }
    if (!body.id) {
      return NextResponse.json({ success: false, error: "Indica el centro de coste." }, { status: 400 })
    }
    if (body.isActive === false) {
      await deactivateCostCenter(companyId, body.id)
    }
    const costCenters = await listCostCenters(companyId)
    return NextResponse.json({ success: true, costCenters })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
