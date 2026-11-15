import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { getBankDetails, saveBankDetails } from "@/lib/payments/bank-transfer"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requirePlatformOperator(request)
    return NextResponse.json({ success: true, bank: await getBankDetails() })
  } catch (error) {
    return authErrorResponse(error)
  }
}

/** Cambia el IBAN, el beneficiario y las indicaciones que ven los clientes en /checkout/transferencia. */
export async function PUT(request: Request) {
  try {
    const session = await requirePlatformOperator(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const bank = await saveBankDetails(session.user.id, body ?? {})
    return NextResponse.json({ success: true, bank })
  } catch (error) {
    return authErrorResponse(error)
  }
}
