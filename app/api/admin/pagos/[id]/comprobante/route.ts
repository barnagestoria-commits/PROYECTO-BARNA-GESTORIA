import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { getPaymentProofForOperator } from "@/lib/payments/bank-transfer"
import { assertPaymentProofKey, getStoredObject } from "@/lib/storage/object-storage"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

/** El justificante está en un almacén privado: solo el operador lo ve, a través de esta ruta. */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePlatformOperator(request)
    const { id } = await context.params
    const proof = await getPaymentProofForOperator(id)
    if (!proof) {
      return NextResponse.json({ success: false, error: "No se encontró el justificante." }, { status: 404 })
    }

    assertPaymentProofKey(proof.comprobanteKey)
    const body = await getStoredObject(proof.comprobanteKey)

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": proof.contentType,
        "Content-Disposition": `inline; filename="${proof.fileName.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "Content-Length": String(body.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
