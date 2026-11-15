import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { approvePayment } from "@/lib/payments/bank-transfer"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requirePlatformOperator(request)
    const { id } = await context.params
    if (!id?.trim()) {
      return NextResponse.json({ success: false, error: "Indica el pago que quieres aprobar." }, { status: 400 })
    }
    const { userId } = await approvePayment(id.trim(), session.user.id)
    return NextResponse.json({ success: true, userId })
  } catch (error) {
    return authErrorResponse(error)
  }
}
