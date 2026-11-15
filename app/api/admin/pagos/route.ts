import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { listPaymentsForOperator, type PagoEstado } from "@/lib/payments/bank-transfer"

export const runtime = "nodejs"

const FILTERS = new Set(["pendiente", "aprobado", "rechazado", "todos"])

export async function GET(request: Request) {
  try {
    await requirePlatformOperator(request)
    const raw = new URL(request.url).searchParams.get("estado") ?? "pendiente"
    const filter = (FILTERS.has(raw) ? raw : "pendiente") as PagoEstado | "todos"
    const payments = await listPaymentsForOperator(filter)
    return NextResponse.json(
      { success: true, payments },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
