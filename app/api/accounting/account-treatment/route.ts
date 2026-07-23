import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  getAccountTreatment,
  upsertAccountTreatment,
} from "@/lib/accounting/account-treatment-service"
import type { AccountTreatmentConfigInput } from "@/lib/accounting/account-treatment-types"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const accountCode = new URL(request.url).searchParams.get("accountCode")?.trim()

    if (!accountCode) {
      return NextResponse.json(
        { success: false, error: "Indica el código de cuenta." },
        { status: 400 },
      )
    }

    const treatment = await getAccountTreatment(companyId, accountCode)

    return NextResponse.json({
      success: true,
      treatment,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      accountCode?: string
      treatment?: AccountTreatmentConfigInput
    }

    if (!body.accountCode?.trim() || !body.treatment) {
      return NextResponse.json(
        { success: false, error: "Cuenta y parametrización son obligatorias." },
        { status: 400 },
      )
    }

    const treatment = await upsertAccountTreatment(companyId, body.accountCode, body.treatment)

    return NextResponse.json({ success: true, treatment })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
