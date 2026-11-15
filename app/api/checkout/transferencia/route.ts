import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { getBankDetails, listOwnPayments, submitPaymentReceipt } from "@/lib/payments/bank-transfer"
import { MAX_RECEIPT_BYTES } from "@/lib/payments/receipt-file"
import { resolveCheckoutPlan } from "@/lib/payments/checkout-plan"

export const runtime = "nodejs"

/** Datos bancarios, referencia del cliente y sus justificantes anteriores. */
export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const [bank, payments, user, checkout] = await Promise.all([
      getBankDetails(),
      listOwnPayments(session.user.id),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { isActive: true } }),
      resolveCheckoutPlan(session.user.accountId),
    ])

    return NextResponse.json(
      {
        success: true,
        bank,
        // El concepto de la transferencia es el ID del usuario, tal como se pidió.
        reference: session.user.id,
        isActive: user?.isActive ?? false,
        access: session.user.access,
        plan: checkout.plan,
        needsPlanSelection: checkout.needsPlanSelection,
        payments,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}

/** Sube el justificante (multipart, campo "file"), lo guarda y crea el pago pendiente. */
export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)

    const declaredLength = Number(request.headers.get("content-length") ?? "0")
    if (declaredLength > MAX_RECEIPT_BYTES + 512 * 1024) {
      return NextResponse.json(
        { success: false, error: "El archivo pesa más de 4 MB. Sube una foto más pequeña o el PDF del banco." },
        { status: 413 },
      )
    }

    const checkout = await resolveCheckoutPlan(session.user.accountId)
    if (checkout.needsPlanSelection) {
      return NextResponse.json(
        { success: false, error: "Elige primero el plan que quieres contratar." },
        { status: 400 },
      )
    }

    const formData = await request.formData().catch(() => null)
    const file = formData?.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Adjunta el justificante de la transferencia." }, { status: 400 })
    }

    const result = await submitPaymentReceipt(
      session.user.id,
      { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
      checkout.plan,
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
